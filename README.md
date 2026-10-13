# Mobile-Based-Campus-Navigation-Assistant

This project aims to develop a mobile-based navigation assistant that estimates a user's
location on campus without using GPS. Instead, the system relies on image-based landmark
recognition and distance estimation. The final deliverable is a mobile application that
identifies campus buildings and determines the user's position based on captured images.

# Dataset Collection
To train the landmark recognition model, we collected a total of 157 images of various
campus buildings.
List of landmarks covered and number of images collected:
- Block A: 19 images
- Block B: 36 images
- Block C: 13 images
- Block D: 19 images
- Block E: 19 images
- Block F: 34 images
- IEEE Office: 17 images
# Challenges faced during dataset collection included:
- Lighting conditions affected image clarity in some cases.
- Trees obstructed clear visibility of some landmarks.
- People and vehicles partially blocked some building views.

# Landmark Recognition Model
A CNN model based on MobileNetV2 was used for recognizing landmarks from images
# Data Preparation
• Images were resized to 224x224 pixels and augmented using rotation, shift, shear, zoom,
and flip.
• Dataset was split into 80% training and 20% validation.
# Model Architecture
• Base Model: MobileNetV2 (pretrained on ImageNet)
• Layers added: GlobalAveragePooling2D, Dropout(0.3), Dense(128), Dropout(0.2), Output
Dense with softmax
# Training Details
• Optimizer: Adam (lr=0.001)
• Loss: Categorical Crossentropy 
• Callbacks: EarlyStopping and ReduceLROnPlateau
• Class Weights: Used to address class imbalance
# Fine-Tuning
• Last 50 layers of MobileNetV2 were unfrozen
• L2 regularization added
• Learning rate set to 1e-5
• Mixup augmentation applied

# Evaluation Results
• Initial Accuracy: 0.81
• Fine-tuned Accuracy: 0.87
• Macro Precision: 0.90
• Macro Recall: 0.86
• Macro F1-Score: 0.87
• Metrics: Accuracy

.////////////////////////////////////////////////////////////////////
