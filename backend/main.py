import requests
import base64
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import io
from typing import Dict, Any
import tensorflow
import keras
from keras.preprocessing import image
from keras.models import load_model
import matplotlib.pyplot as plt
import os
import logging
from datetime import datetime
from PIL import Image, UnidentifiedImageError

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("api_debug.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# ---------------- CONFIGURATION ----------------

# Object detection configuration
API_KEY = "WZ79fSHJRHMwC97k3fjI"
MODEL_ID = "cv-project-rzcj9/4"
DEFAULT_FOCAL_LENGTH = 2000  # Default focal length if no landmark is detected

# Focal length mapping for each landmark
FOCAL_LENGTH_MAP = {
    "Block A": 2000,
    "Block B": 2000,
    "Block C": 2000,
    "Block D": 2000,
    "Block E": 2000,
    "IEEE Office": 2000,
    "NB": 2000
}

# Landmark classification configuration
LANDMARK_MODEL_PATH = "landmark_model.h5"  # Update with your model path
IMG_SIZE = (224, 224)  # Update based on your model's expected input

# Real-world object dimensions in meters (update if needed)
OBJECT_DIMENSIONS = {
    "door-block-a": {"height": 2.5, "width": 2.5},
    "door-block-b": {"height": 2, "width": 1.5},
    "door-block-c": {"height": 2.2, "width": 2.2},
    "door-block-d": {"height": 2.5, "width": 2.2},
    "door-block-e": {"height": 1.5, "width": 1.2},
    "door-block-nb": {"height": 2.2, "width": 2.2},
    "door-block-nb-2": {"height": 2.3, "width": 1.1},
    "library-board-block-e": {"height": 0.6, "width": 0.9},
    "logo-block-c": {"height": 0.8, "width": 0.8},
    "main-window-block-a": {"height": 2.2, "width": 2.8},
    "main-window-block-c": {"height": 2.2, "width": 2.8},
    "main-window-block-d": {"height": 2.2, "width": 2.8},
    "main-window-block-e": {"height": 2, "width": 1.4},
    "map-block-a": {"height": 0.5, "width": 0.5},
    "shade-ieee": {"height": 2, "width": 2},
    "signboard-block-a": {"height": 0.3, "width": 0.3},
    "signboard-block-b": {"height": 0.3, "width": 0.3},
    "signboard-block-c": {"height": 0.3, "width": 0.3},
    "signboard-block-d": {"height": 0.6, "width": 0.6},
    "signboard-block-e": {"height": 0.3, "width": 0.3},
    "signboard-block-nb": {"height": 0.3, "width": 0.3},
    "softecboard-block-e": {"height": 2, "width": 0.8},
    "softecboard-2-block-e": {"height": 2, "width": 0.8},
    "window-block-a": {"height": 1.8, "width": 1.2},
    "window-block-b": {"height": 1.8, "width": 1.2},
    "window-block-c": {"height": 2.2, "width": 1.2},
    "window-block-d": {"height": 1.8, "width": 1.2},
    "window-block-e": {"height": 1.8, "width": 1.2},
    "window-block-nb": {"height": 2.2, "width": 1.2},
    "window-ieee": {"height": 1, "width": 0.8},
}

# ---------------- LOAD MODELS ----------------

# Load landmark classification model
try:
    logger.info(f"Attempting to load landmark model from {LANDMARK_MODEL_PATH}")
    landmark_model = load_model(LANDMARK_MODEL_PATH)
    # Get class names (you'll need to provide these based on your training)
    CLASS_NAMES = ["Block A", "Block B", "Block C","Block D","Block E","IEEE Office","NB"]
    logger.info(f"Landmark model loaded successfully. Class names: {CLASS_NAMES}")
except Exception as e:
    logger.error(f"Error loading landmark model: {str(e)}")
    landmark_model = None
    CLASS_NAMES = []

# ---------------- HELPER FUNCTIONS ----------------

def estimate_distance(real_size, focal_length, pixel_size):
    distance = (real_size * focal_length) / pixel_size
    logger.debug(f"Distance calculation - real_size: {real_size}, focal_length: {focal_length}, pixel_size: {pixel_size} => distance: {distance}")
    return distance

def encode_image_base64(image_bytes):
    try:
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        logger.debug("Image encoded to base64 successfully")
        return encoded
    except Exception as e:
        logger.error(f"Error encoding image to base64: {str(e)}")
        raise

def get_focal_length_for_landmark(landmark_name):
    """Get the appropriate focal length based on the detected landmark"""
    if landmark_name in FOCAL_LENGTH_MAP:
        focal_length = FOCAL_LENGTH_MAP[landmark_name]
        logger.info(f"Using focal length {focal_length} for landmark {landmark_name}")
        return focal_length
    else:
        logger.warning(f"No focal length configured for landmark {landmark_name}, using default {DEFAULT_FOCAL_LENGTH}")
        return DEFAULT_FOCAL_LENGTH

def process_image(image_bytes, focal_length=None):
    logger.info("Starting image processing")
    try:
        start_time = datetime.now()

        # If no focal length provided, use default
        if focal_length is None:
            focal_length = DEFAULT_FOCAL_LENGTH
            logger.info(f"No focal length provided, using default: {focal_length}")
        
        # Validate image bytes
        if not image_bytes:
            logger.error("Received empty image bytes")
            raise HTTPException(status_code=400, detail="Empty image file")

        # Convert bytes to numpy array
        logger.debug("Converting image bytes to numpy array")
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            logger.error("Failed to decode image")
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Perform inference
        logger.info("Sending image to Roboflow API for object detection")
        image_b64 = encode_image_base64(image_bytes)
        roboflow_start = datetime.now()
        response = requests.post(
            f"https://detect.roboflow.com/{MODEL_ID}?api_key={API_KEY}",
            data=image_b64,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        roboflow_time = (datetime.now() - roboflow_start).total_seconds()
        logger.info(f"Roboflow API response received in {roboflow_time:.2f} seconds")

        if response.status_code != 200:
            logger.error(f"Roboflow API error: {response.status_code} - {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Object detection API error")

        results = response.json()
        logger.debug(f"Raw detection results: {results}")

        # Visualization parameters
        BOX_COLOR = (0, 255, 255)  # yellow in BGR format
        TEXT_COLOR = (0, 0, 0)      # Black
        OUTLINE_COLOR = (255, 255, 255)  # White
        BOX_THICKNESS = 10
        FONT_SCALE = 1.2
        FONT_THICKNESS = 3
        TEXT_BG_PADDING = 15
        BOX_PADDING_PCT = 0.05  # 5% padding

        total_distance = 0
        count = 0
        predictions = []

        for prediction in results.get("predictions", []):
            class_name = prediction["class"]
            confidence = prediction["confidence"]
            x = prediction["x"]
            y = prediction["y"]
            width = prediction["width"]
            height = prediction["height"]

            logger.debug(f"Processing prediction: {class_name} (conf: {confidence:.2f}) at ({x},{y}) size {width}x{height}")

            if class_name in OBJECT_DIMENSIONS:
                real_h = OBJECT_DIMENSIONS[class_name]["height"]
                real_w = OBJECT_DIMENSIONS[class_name]["width"]
                dist_h = estimate_distance(real_h, focal_length, height)
                dist_w = estimate_distance(real_w, focal_length, width)
                distance = (dist_h + dist_w) / 2
                total_distance += distance
                count += 1
                logger.info(f"Detected {class_name} at {distance:.2f}m (h: {dist_h:.2f}m, w: {dist_w:.2f}m)")
            else:
                distance = 0
                logger.warning(f"Unknown object class detected: {class_name} - distance calculation skipped")

            # Calculate box coordinates with padding
            padding = int(min(width, height) * BOX_PADDING_PCT)
            x1 = max(0, int(x - width/2) - padding)
            y1 = max(0, int(y - height/2) - padding)
            x2 = min(image.shape[1], int(x + width/2) + padding)
            y2 = min(image.shape[0], int(y + height/2) + padding)

            # Draw bounding box
            cv2.rectangle(image, (x1, y1), (x2, y2), BOX_COLOR, BOX_THICKNESS)

            # Prepare text label
            label = f"{class_name} - {distance:.2f}m"
            (label_width, label_height), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, FONT_SCALE, FONT_THICKNESS
            )

            # Calculate text background position
            text_bg_y1 = max(0, y1 - TEXT_BG_PADDING - label_height)
            text_bg_y2 = y1 - TEXT_BG_PADDING

            # Draw text background
            cv2.rectangle(image,
                (x1, text_bg_y1),
                (x1 + label_width + 10, text_bg_y2 + TEXT_BG_PADDING),
                BOX_COLOR, -1
            )

            # Draw text outline
            cv2.putText(image, label, 
                (x1 + 5, text_bg_y2 - 5), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                FONT_SCALE, 
                OUTLINE_COLOR, 
                FONT_THICKNESS + 2
            )

            # Draw main text
            cv2.putText(image, label, 
                (x1 + 5, text_bg_y2 - 5), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                FONT_SCALE, 
                TEXT_COLOR, 
                FONT_THICKNESS
            )

            predictions.append({
                "class": class_name,
                "confidence": confidence,
                "distance": distance,
                "bbox": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2
                }
            })

        # Calculate average distance
        average_distance = total_distance / count if count > 0 else 0
        logger.info(f"Average distance of detected objects: {average_distance:.2f}m ({count} objects)")

        # Resize image while maintaining aspect ratio
        target_width = 1280
        target_height = 720
        scale = min(target_width/image.shape[1], target_height/image.shape[0])
        resized_img = cv2.resize(image, 
                               (int(image.shape[1]*scale), int(image.shape[0]*scale)),
                               interpolation=cv2.INTER_LINEAR)

        # Convert image to bytes
        _, img_encoded = cv2.imencode('.jpg', resized_img, 
                                    [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        img_bytes = img_encoded.tobytes()

        processing_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"Image processing completed in {processing_time:.2f} seconds with focal length {focal_length}")

        return {
            "predictions": predictions,
            "average_distance": average_distance,
            "processed_image": img_bytes,
            "count": count,
            "focal_length": focal_length
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    

def predict_landmark(img_bytes):
    logger.info("Starting landmark prediction")
    try:
        start_time = datetime.now()

        # Validate image bytes
        if not img_bytes:
            logger.error("Received empty image bytes")
            raise HTTPException(status_code=400, detail="Empty image file")

        # Convert bytes to numpy array using PIL Image
        logger.debug("Converting image bytes to PIL Image for landmark prediction")
        try:
            img_pil = Image.open(io.BytesIO(img_bytes))
        except UnidentifiedImageError:
            logger.error("Unidentified image file")
            raise HTTPException(status_code=400, detail="Unidentified image file")

        img_pil = img_pil.resize(IMG_SIZE)

        # Convert PIL Image to numpy array
        img_array = np.array(img_pil)

        # Normalize and expand dimensions for model input
        img_array = img_array / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        # Make prediction
        logger.info("Running landmark model prediction")
        pred_start = datetime.now()
        pred = landmark_model.predict(img_array)
        pred_time = (datetime.now() - pred_start).total_seconds()
        logger.info(f"Landmark prediction completed in {pred_time:.2f} seconds")

        pred_class = CLASS_NAMES[np.argmax(pred)]
        confidence = float(np.max(pred))
        logger.info(f"Landmark prediction: {pred_class} (confidence: {confidence:.2f})")

        # Get focal length for this landmark
        focal_length = get_focal_length_for_landmark(pred_class)

        # Generate visualization
        logger.debug("Generating prediction visualization")
        plt.figure()
        plt.imshow(img_pil)
        plt.title(f"Prediction: {pred_class}\nConfidence: {confidence:.2f}\nFocal Length: {focal_length}")
        plt.axis('off')

        # Save the visualization to a bytes buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='jpg', bbox_inches='tight', pad_inches=0)
        buf.seek(0)
        vis_bytes = buf.read()
        plt.close()

        total_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"Landmark prediction completed in {total_time:.2f} seconds")

        return {
            "landmark": pred_class,
            "confidence": confidence,
            "visualization": vis_bytes,
            "focal_length": focal_length
        }
    except Exception as e:
        logger.error(f"Error in landmark prediction: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ---------------- API ENDPOINTS ----------------

@app.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
    logger.info(f"Received request on /detect endpoint")
    if not file.content_type.startswith('image/'):
        logger.error(f"Invalid file type received: {file.content_type}")
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        image_bytes = await file.read()
        logger.info(f"Received image of size {len(image_bytes)} bytes")
        result = process_image(image_bytes)
        logger.info("Detection results ready")
        return {
            "predictions": result["predictions"],
            "average_distance": result["average_distance"],
            "count": result["count"],
            "focal_length": result["focal_length"]
        }
    except Exception as e:
        logger.error(f"Error in /detect endpoint: {str(e)}", exc_info=True)
        raise

@app.post("/detect-with-image")
async def detect_objects_with_image(file: UploadFile = File(...)):
    logger.info(f"Received request on /detect-with-image endpoint")
    if not file.content_type.startswith('image/'):
        logger.error(f"Invalid file type received: {file.content_type}")
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        image_bytes = await file.read()
        logger.info(f"Received image of size {len(image_bytes)} bytes")
        result = process_image(image_bytes)
        logger.info("Returning processed image")
        return StreamingResponse(io.BytesIO(result["processed_image"]), media_type="image/jpeg")
    except Exception as e:
        logger.error(f"Error in /detect-with-image endpoint: {str(e)}", exc_info=True)
        raise

@app.post("/detect-landmark-and-objects")
async def detect_landmark_and_objects(file: UploadFile = File(...)):
    logger.info(f"Received request on /detect-landmark-and-objects endpoint")
    if not file.content_type.startswith('image/'):
        logger.error(f"Invalid file type received: {file.content_type}")
        raise HTTPException(status_code=400, detail="File must be an image")

    if landmark_model is None:
        logger.error("Landmark model not loaded when requested")
        raise HTTPException(status_code=503, detail="Landmark model not loaded")

    try:
        image_bytes = await file.read()
        logger.info(f"Received image of size {len(image_bytes)} bytes")

        # First predict the landmark
        logger.info("Starting landmark prediction")
        landmark_result = predict_landmark(image_bytes)
        
        # Get the focal length for this landmark
        focal_length = landmark_result["focal_length"]

        # Then detect objects and distances using the landmark-specific focal length
        logger.info(f"Starting object detection with focal length {focal_length}")
        detection_result = process_image(image_bytes, focal_length)

        logger.info("Combined results ready")
        return {
            "landmark": landmark_result["landmark"],
            "landmark_confidence": landmark_result["confidence"],
            "focal_length": focal_length,
            "objects": detection_result["predictions"],
            "average_distance": detection_result["average_distance"],
            "count": detection_result["count"],
            "processed_image_base64": base64.b64encode(detection_result["processed_image"]).decode("utf-8")
        }
    except Exception as e:
        logger.error(f"Error in /detect-landmark-and-objects endpoint: {str(e)}", exc_info=True)
        raise

@app.post("/detect-landmark-and-objects-with-image")
async def detect_landmark_and_objects_with_image(file: UploadFile = File(...)):
    logger.info(f"Received request on /detect-landmark-and-objects-with-image endpoint")
    if not file.content_type.startswith('image/'):
        logger.error(f"Invalid file type received: {file.content_type}")
        raise HTTPException(status_code=400, detail="File must be an image")

    if landmark_model is None:
        logger.error("Landmark model not loaded when requested")
        raise HTTPException(status_code=503, detail="Landmark model not loaded")

    try:
        image_bytes = await file.read()
        logger.info(f"Received image of size {len(image_bytes)} bytes")

        # First predict the landmark
        logger.info("Starting landmark prediction")
        landmark_result = predict_landmark(image_bytes)
        
        # Get the focal length for this landmark
        focal_length = landmark_result["focal_length"]

        # Then detect objects and distances using the landmark-specific focal length
        logger.info(f"Starting object detection with focal length {focal_length}")
        detection_result = process_image(image_bytes, focal_length)

        logger.info("Returning processed image")
        return StreamingResponse(io.BytesIO(detection_result["processed_image"]), media_type="image/jpeg")
    except Exception as e:
        logger.error(f"Error in /detect-landmark-and-objects-with-image endpoint: {str(e)}", exc_info=True)
        raise

@app.get("/object-dimensions")
async def get_object_dimensions():
    logger.info("Received request for object dimensions")
    return OBJECT_DIMENSIONS

@app.get("/landmark-classes")
async def get_landmark_classes():
    logger.info("Received request for landmark classes")
    return {"class_names": CLASS_NAMES}

@app.get("/focal-length-map")
async def get_focal_length_map():
    logger.info("Received request for focal length mapping")
    return FOCAL_LENGTH_MAP

if __name__ == "__main__":
    logger.info("Starting FastAPI server")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, log_config=None)