// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ActivityIndicator,
    Alert,
    Platform,
    StatusBar,
    Dimensions,
    Pressable // Using Pressable for more custom button interactions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Animated, { FadeIn, FadeOut, FadeInUp, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons'; // Using Feather and Ionicons

// Removed AnimatedButton import, using Pressable + Animated.View now
import { processImage } from '../api/mockApi';

const { width, height } = Dimensions.get('window');

// --- Reusable Animated Pressable Button ---
// Extracted for clarity, can be moved to components/ folder
const AnimatedPressable = ({ children, onPress, style, entering, ...props }) => {
    return (
        <Animated.View entering={entering}>
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [
                    style,
                    { opacity: pressed ? 0.7 : 1 } // Basic press feedback
                ]}
                {...props}
            >
                {children}
            </Pressable>
        </Animated.View>
    );
};


export default function HomeScreen({ navigation }) {
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [userLocation, setUserLocation] = useState(null);

    // --- Core Logic (Permissions, Image Handling, Analysis) - Kept Unchanged ---
    useEffect(() => {
        // Same permission request logic as before
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Location Permission Recommended',
                    'Location permission helps calculate landmark distance accurately. You can grant it from settings later.',
                    [{ text: 'OK' }]
                );
            }
        })();
    }, []);

    const requestPermissions = async () => {
        // Same robust permission checking logic as before
        let permissionsGranted = true;
        if (Platform.OS !== 'web') {
            const cRStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
            const cStatus = await ImagePicker.requestCameraPermissionsAsync();
            if (cRStatus.status !== 'granted' || cStatus.status !== 'granted') {
                Alert.alert('Permissions Required', 'Camera and Photo Library permissions are needed. Please grant them in settings.', [{ text: 'OK' }]);
                permissionsGranted = false;
            }
        }
        let { status: locStatus } = await Location.getForegroundPermissionsAsync();
        if (locStatus !== 'granted') locStatus = (await Location.requestForegroundPermissionsAsync()).status;
        if (locStatus !== 'granted') {
            Alert.alert('Location Permission Denied', 'Distance calculation may be unavailable. Proceeding without location.', [{ text: 'OK' }]);
        }
        return permissionsGranted;
    };

    const handleImageAction = async (action) => {
        // Same logic as before
        const hasRequiredPermissions = await requestPermissions();
        if (!hasRequiredPermissions) return;

        let result;
        try {
            const options = { allowsEditing: true, quality: 0.8 };
            if (action === 'take') {
                result = await ImagePicker.launchCameraAsync(options);
            } else {
                result = await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ImagePicker.MediaTypeOptions.Images });
            }

            if (!result.canceled && result.assets && result.assets.length > 0) {
                await analyzeImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error("Image Picker Error: ", error);
            Alert.alert('Error', 'Could not access camera or library.');
            setIsLoading(false); setStatusMessage('');
        }
    };

    const analyzeImage = async (imageUri) => {
         // Same analysis logic as before
        setIsLoading(true);
        setStatusMessage('Finding your location...');
        let currentLocation = null;
        try {
            let { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
                currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeout: 10000 });
                setUserLocation(currentLocation);
                console.log("Location Acquired:", currentLocation?.coords);
                setStatusMessage('Analyzing image...');
            } else {
                console.log("Location denied, proceeding without.");
                setStatusMessage('Location off, analyzing image...');
            }

            const apiResponse = await processImage(imageUri, currentLocation);

            if (apiResponse.success) {
                navigation.navigate('Result', {
                    resultData: apiResponse.data,
                    imageUri: imageUri,
                    userCoords: currentLocation?.coords
                });
            } else {
                Alert.alert('Analysis Failed', apiResponse.error || 'Could not process image.');
            }
        } catch (error) {
            console.error("Analysis Error:", error);
            if (error.code === 'E_LOCATION_TIMEOUT') {
                Alert.alert('Location Timeout', 'Could not get location. Check services and try again.');
                 // Decide: proceed without location or stop? Example: proceed
                 // setStatusMessage('Location timed out, analyzing...');
                 // const apiResponse = await processImage(imageUri, null); ... handle response ...
            } else {
                Alert.alert('Error', 'Analysis error. Check connection and try again.');
            }
        } finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    };
    // --- End of Core Logic ---

    return (
        <LinearGradient
            // More vibrant / deeper blue gradient
            colors={['#0052D4', '#4364F7', '#6FB1FC']} // Example: Deep Blue to Lighter Blue
            // colors={['#141e30', '#243b55']} // Example: Darker Space Blue
            style={styles.container}
        >
            <StatusBar barStyle="light-content" />

            {/* Background Shapes */}
            <Animated.View style={[styles.bgShape, styles.bgShape1]} entering={FadeIn.duration(1500).delay(500)} />
            <Animated.View style={[styles.bgShape, styles.bgShape2]} entering={FadeIn.duration(1500).delay(700)} />
            <Animated.View style={[styles.bgShape, styles.bgShape3]} entering={FadeIn.duration(1500).delay(900)} />

            <View style={styles.content}>
                <Animated.Text style={styles.title} entering={FadeInDown.duration(800).delay(200)}>
                    FastEye
                </Animated.Text>
                <Animated.Text style={styles.subtitle} entering={FadeInDown.duration(800).delay(400)}>
                    Point, Shoot, Identify.
                </Animated.Text>

                {/* --- Central Focus / Scan Area --- */}
                <Animated.View style={styles.scanArea} entering={ZoomIn.duration(700).delay(600)}>
                    {isLoading ? (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color="#FFFFFF" />
                            <Animated.Text
                                entering={FadeIn}
                                exiting={FadeOut}
                                style={styles.statusText}
                            >
                                {statusMessage || 'Processing...'}
                            </Animated.Text>
                        </View>
                    ) : (
                        <Ionicons name="scan-outline" size={width * 0.35} color="rgba(255, 255, 255, 0.6)" />
                    )}
                </Animated.View>


                {/* --- Action Buttons --- */}
                {!isLoading && ( // Only show buttons when not loading
                    <View style={styles.buttonContainer}>
                        <AnimatedPressable
                            onPress={() => handleImageAction('take')}
                            style={[styles.button, styles.buttonTake]}
                            entering={FadeInUp.duration(600).delay(800)}
                            accessibilityLabel="Take Picture"
                        >
                            <Feather name="camera" size={24} color="#3A7BD5" />
                            <Text style={[styles.buttonText, styles.buttonTextTake]}>Take</Text>
                        </AnimatedPressable>

                        <AnimatedPressable
                            onPress={() => handleImageAction('upload')}
                            style={[styles.button, styles.buttonUpload]}
                            entering={FadeInUp.duration(600).delay(950)}
                            accessibilityLabel="Upload Image"
                        >
                            <Feather name="upload" size={24} color="#FFFFFF" />
                             <Text style={[styles.buttonText, styles.buttonTextUpload]}>Upload</Text>
                        </AnimatedPressable>
                    </View>
                 )}
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden', // Hide parts of shapes that go outside bounds
    },
    // --- Background Shapes ---
    bgShape: {
        position: 'absolute',
        borderRadius: (width * 0.8) / 2, // Make them circular
        opacity: 0.1, // Very subtle
    },
    bgShape1: {
        width: width * 0.8,
        height: width * 0.8,
        top: -width * 0.2,
        left: -width * 0.3,
        backgroundColor: '#E0F7FA', // Light cyan tint
        transform: [{ rotate: '15deg' }],
    },
    bgShape2: {
        width: width * 0.6,
        height: width * 0.6,
        bottom: -width * 0.15,
        right: -width * 0.2,
        backgroundColor: '#B3E5FC', // Slightly darker light blue
        transform: [{ rotate: '-20deg' }],
    },
     bgShape3: {
        width: width * 0.5,
        height: width * 0.5,
        top: height * 0.3,
        right: -width * 0.15,
        backgroundColor: '#81D4FA', // Medium light blue
        opacity: 0.08,
        transform: [{ rotate: '30deg' }],
    },
    // --- Content Layout ---
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-around', // Distribute space
        paddingHorizontal: 30,
        paddingTop: height * 0.15, // Push content down a bit
        paddingBottom: height * 0.1,
    },
    title: {
        fontSize: width * 0.14, // Responsive font size
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: 1, // Add some spacing
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 1, height: 2 },
        textShadowRadius: 3,
    },
    subtitle: {
        fontSize: width * 0.045, // Responsive
        color: 'rgba(255, 255, 255, 0.85)', // Slightly transparent white
        marginTop: 10,
        marginBottom: height * 0.05, // Space before scan area
        textAlign: 'center',
        fontWeight: '300', // Lighter weight for subtitle
    },
    // --- Scan Area ---
    scanArea: {
        width: width * 0.55,
        height: width * 0.55,
        borderRadius: (width * 0.55) / 2, // Make it circular
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        // backgroundColor: 'rgba(255, 255, 255, 0.05)', // Optional subtle background
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: height * 0.08, // Space before buttons
        position: 'relative', // Needed for loading overlay absolute positioning
    },
     loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // backgroundColor: 'rgba(0, 0, 0, 0.3)', // Optional darker overlay
        borderRadius: (width * 0.55) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10, // Prevent text overflow on smaller loaders
    },
    statusText: {
        marginTop: 15,
        fontSize: 14, // Slightly smaller status text
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        fontWeight: '500',
    },
    // --- Buttons ---
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around', // Space out buttons
        alignItems: 'center',
        width: '100%', // Take full width to space out buttons inside
        maxWidth: 500, // Max width for button area
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 25, // Adjust padding for content
        borderRadius: 50, // Fully rounded ends
        minWidth: width * 0.35, // Minimum width for buttons
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
    },
    buttonTake: {
        backgroundColor: '#FFFFFF', // White background for primary action
    },
    buttonUpload: {
         backgroundColor: 'rgba(255, 255, 255, 0.2)', // Secondary action less prominent
         borderWidth: 1,
         borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8, // Space between icon and text
    },
    buttonTextTake: {
         color: '#3A7BD5', // Blue text matching the theme
    },
     buttonTextUpload: {
         color: '#FFFFFF',
    },
});