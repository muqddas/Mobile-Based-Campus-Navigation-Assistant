// api/mockApi.js
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Mock landmark data (replace with your actual known landmarks)
const mockLandmarks = [
    {
        name: 'NB', // Example Lahore landmark
        coords: { latitude: 31.480440, longitude: 74.304080 },
    }, {
        name: 'IEEE Office',
        coords: { latitude: 31.481024, longitude: 74.303869 }
    }, {
        name: 'Block D',
        coords: { latitude: 31.481099, longitude: 74.303486 }
    }, {
        name: 'Block B',
        coords: { latitude: 31.4814380, longitude: 74.3030788 }
    }, {
        name: 'Block C',
        coords: { latitude: 31.481157, longitude: 74.302780 }
    }, {
        name: 'Block A',
        coords: { latitude: 31.481424, longitude: 74.303704 }
    }
];

// Function to calculate distance (Haversine formula)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// Function to find a landmark in our mockLandmarks by name
function findLandmarkByName(name) {
    return mockLandmarks.find(landmark =>
        landmark.name.toLowerCase() === name.toLowerCase()
    );
}

// Function to compress image to under 1MB
const compressImage = async (imageUri) => {
    try {
        // First get the file info to check size
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        let fileSizeMB = fileInfo.size / (1024 * 1024);
        console.log(`Original image size: ${fileSizeMB.toFixed(2)} MB`);

        if (fileSizeMB <= 1) {
            console.log('Image is already under 1MB, no compression needed');
            return imageUri;
        }

        // Calculate compression ratio (target 0.9MB to be safe)
        const targetSizeBytes = 0.9 * 1024 * 1024; // 0.9MB in bytes
        const compressionRatio = targetSizeBytes / fileInfo.size;

        // Manipulate the image (compress and optionally resize)
        const compressedImage = await manipulateAsync(
            imageUri,
            [], // No operations needed, just compression
            {
                compress: Math.min(0.9, compressionRatio), // Max 0.9 compression
                format: SaveFormat.JPEG,
            }
        );

        // Check the new size
        const newFileInfo = await FileSystem.getInfoAsync(compressedImage.uri);
        fileSizeMB = newFileInfo.size / (1024 * 1024);
        console.log(`Compressed image size: ${fileSizeMB.toFixed(2)} MB`);

        if (fileSizeMB > 1) {
            // If still too large, try more aggressive compression
            console.log('First compression not sufficient, trying more aggressive compression');
            const moreCompressedImage = await manipulateAsync(
                imageUri,
                [],
                {
                    compress: 0.7, // More aggressive compression
                    format: SaveFormat.JPEG,
                }
            );
            return moreCompressedImage.uri;
        }

        return compressedImage.uri;
    } catch (error) {
        console.error('Error compressing image:', error);
        return imageUri; // Fallback to original if compression fails
    }
};

// Function to calculate user coordinates based on landmark coordinates and distance
function calculateUserCoords(landmarkCoords, distanceMeters) {
    // For simplicity, assume the user is directly north of the landmark
    const distanceKm = distanceMeters / 1000;
    const latitudeOffset = distanceKm / 111.32; // Approximate offset in degrees for latitude
    const longitudeOffset = distanceKm / (111.32 * Math.cos(deg2rad(landmarkCoords.latitude))); // Approximate offset in degrees for longitude

    return {
        latitude: landmarkCoords.latitude + latitudeOffset,
        longitude: landmarkCoords.longitude, // Assuming no longitude change for simplicity
    };
}

export const processImage = async (imageUri, userLocation) => {
    try {
        // 1. First compress the image
        const compressedUri = await compressImage(imageUri);
        console.log('Using compressed image:', compressedUri);

        // 2. Create FormData with the compressed image
        const formData = new FormData();
        formData.append('file', {
            uri: compressedUri,
            type: 'image/jpeg',
            name: 'uploaded_image.jpg',
        });

        // 3. POST to /detect API
        const response = await fetch('http://192.168.1.103:8000/detect-landmark-and-objects', {
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data',
                // 'ngrok-skip-browser-warning ' : 'true'
            },
            body: formData,
        });

        const data = await response.json();

        console.log('API response:', data);

        // Add this line to get the processed image
        const processedImageUri = `data:image/jpeg;base64,${data.processed_image_base64}`;

        // Find the actual landmark from our mock data using the detected landmark name
        const detectedLandmarkName = data.landmark;
        const actualLandmark = findLandmarkByName(detectedLandmarkName);

        let calculatedDistance = null;
        let landmarkCoords = null;
        let userCoords = null;

        if (actualLandmark) {
            // Use the actual landmark coordinates
            landmarkCoords = actualLandmark.coords;

            // Calculate user coordinates based on the estimated distance from the API
            const estimatedDistanceMeters = parseFloat(data.average_distance);
            userCoords = calculateUserCoords(landmarkCoords, estimatedDistanceMeters);

            // Calculate actual distance if user location is available
            if (userLocation?.coords) {
                calculatedDistance = getDistanceFromLatLonInKm(
                    userLocation.coords.latitude,
                    userLocation.coords.longitude,
                    actualLandmark.coords.latitude,
                    actualLandmark.coords.longitude
                );

                // Convert to meters for consistency (API returns in meters)
                calculatedDistance = calculatedDistance * 1000;
                calculatedDistance = `${calculatedDistance.toFixed(2)} meters`;
            } else {
                calculatedDistance = 'N/A (User location missing)';
            }
        } else {
            console.log(`Warning: Landmark "${detectedLandmarkName}" not found in mockLandmarks`);
            calculatedDistance = 'N/A (Landmark not found)';
        }

        const finalResponse = {
            success: true,
            data: {
                processed_image: processedImageUri,
                landmark: data.landmark,
                estimated_distance_from_api: `${data.average_distance} meters`,
                calculated_distance_to_landmark: calculatedDistance,
                landmarkCoords: landmarkCoords,
                userCoords: userCoords,
                apiData: data, // Include the actual API response
            },
        };

        console.log('Final response:', finalResponse);
        return finalResponse;

    } catch (error) {
        console.error('Error in processImage:', error);
        throw error;
    }
};
