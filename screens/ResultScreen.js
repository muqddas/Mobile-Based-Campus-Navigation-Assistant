// screens/ResultScreen.js
import 'react-native-gesture-handler'; // Ensure this is imported (might already be in App.js)
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Image,
    Dimensions,
    ActivityIndicator,
    Platform,
    Pressable, // Using Pressable for back button
    StatusBar
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, interpolate, Extrapolate } from 'react-native-reanimated';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'; // Import BottomSheet components
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons'; // Import icons
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');
const IMAGE_HEIGHT = height * 0.45; // Make image slightly taller
const BOTTOM_SHEET_HANDLE_HEIGHT = 24;
const BOTTOM_SHEET_MIN_HEIGHT = height * 0.25; // Initial visible height

// --- Custom Marker Component --- (Optional: replace with simple Markers if no custom images)
const CustomMarker = ({ coordinate, title, imageSource, color = 'red' }) => (
    <Marker coordinate={coordinate} title={title} anchor={{ x: 0.5, y: 1 }}>
        {imageSource ? (
            <Image source={imageSource} style={styles.markerImage} resizeMode="contain" />
        ) : (
            // Fallback to default coloured pin
            <Ionicons name="location-sharp" size={36} color={color} style={styles.markerIconShadow} />
        )}
    </Marker>
);

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

export default function ResultScreen({ route, navigation }) {
    const { resultData } = route.params;
    const mapRef = useRef(null);
    const bottomSheetRef = useRef(null);
    const [mapReady, setMapReady] = useState(false);

    // Determine if map data is sufficient
    const hasUserCoords = resultData?.userCoords?.latitude && resultData?.userCoords?.longitude;
    const hasLandmarkCoords = resultData?.landmarkCoords?.latitude && resultData?.landmarkCoords?.longitude;
    const canShowMap = hasUserCoords && hasLandmarkCoords;

    // Calculate snap points for the bottom sheet
    const snapPoints = useMemo(() => {
        const midPoint = height * 0.55; // Shows map comfortably
        const highPoint = height * 0.85; // Nearly full screen map
        return [BOTTOM_SHEET_MIN_HEIGHT, midPoint, highPoint];
    }, []);

    // --- Map Region Calculation ---
    const calculateRegion = () => {
        if (!canShowMap) {
            // Default fallback region (Lahore)
            return {
                latitude: 31.5497, longitude: 74.3436,
                latitudeDelta: 0.1, longitudeDelta: 0.1,
            };
        }
        const midLat = (resultData.userCoords.latitude + resultData.landmarkCoords.latitude) / 2;
        const midLon = (resultData.userCoords.longitude + resultData.landmarkCoords.longitude) / 2;
        // Calculate delta based on points, ensuring minimum zoom level
        const latDelta = Math.max(Math.abs(resultData.userCoords.latitude - resultData.landmarkCoords.latitude) * 1.2, 0.005);
        const lonDelta = Math.max(Math.abs(resultData.userCoords.longitude - resultData.landmarkCoords.longitude) * 1.2, 0.005);

        return { latitude: midLat, longitude: midLon, latitudeDelta: latDelta, longitudeDelta: lonDelta };
    };

    const initialRegion = useMemo(calculateRegion, [canShowMap, resultData]);

    // --- Animate Map to Fit Markers ---
    const fitMapToMarkers = useCallback(() => {
        if (mapReady && canShowMap && mapRef.current) {
            const coordinates = [resultData.userCoords, resultData.landmarkCoords, ...mockLandmarks.map(landmark => landmark.coords)];
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                animated: true,
            });
        }
    }, [mapReady, canShowMap, resultData]); // Dependencies for fitting

    // Fit map when it becomes ready or data changes
    useEffect(() => {
        // Delay slightly ensure layout is complete, especially within bottom sheet
        if (mapReady) {
            const timer = setTimeout(fitMapToMarkers, 300);
            return () => clearTimeout(timer);
        }
    }, [mapReady, fitMapToMarkers]);

    // --- Bottom Sheet Content Rendering ---
    const renderBottomSheetContent = useCallback(() => (
        <BottomSheetScrollView contentContainerStyle={styles.bottomSheetContentContainer}>
            {/* Landmark Title */}
            <Animated.Text style={styles.landmarkTitle} entering={FadeInDown.duration(400).delay(100)}>
                {resultData.landmark || 'Landmark Not Identified'}
            </Animated.Text>

            {/* Distance Info Rows */}
            <Animated.View style={styles.infoSection} entering={FadeInDown.duration(400).delay(200)}>
                {/* API Estimated Distance */}
                <View style={styles.infoRow}>
                    <View style={styles.infoLabelContainer}>
                        <MaterialIcons name="photo-camera" size={18} color="#A8B5C1" />
                        <Text style={styles.infoLabel}>Image Estimate:</Text>
                    </View>
                    <Text style={styles.infoValue}>
                        {resultData.estimated_distance_from_api || 'N/A'}
                    </Text>
                </View>

                {/* Calculated GPS Distance */}
                {/* <View style={styles.infoRow}>
                    <View style={styles.infoLabelContainer}>
                        <MaterialIcons name="gps-fixed" size={18} color="#A8B5C1" />
                        <Text style={styles.infoLabel}>GPS Distance:</Text>
                    </View>
                    <Text style={styles.infoValue}>
                        {resultData.gps_distance || 'N/A'}
                    </Text>
                </View> */}
            </Animated.View>

            {/* --- Map Section --- */}
            <Animated.View style={styles.mapSectionContainer} entering={FadeInDown.duration(400).delay(300)}>
                <Text style={styles.mapTitle}>Location Overview</Text>
                {canShowMap ? (
                    <View style={styles.mapContainer}>
                        <MapView
                            ref={mapRef}
                            style={styles.map}
                            provider={PROVIDER_GOOGLE}
                            initialRegion={initialRegion}
                            onMapReady={() => {
                                console.log("Map Ready");
                                setMapReady(true);
                            }}
                            onMapLoaded={() => {
                                console.log("Map Loaded, attempting fit...");
                                fitMapToMarkers(); // Attempt fit again on loaded, sometimes useful
                            }}
                            showsUserLocation={false} // We use a custom marker
                            showsPointsOfInterest={false}
                            mapPadding={{ top: 0, right: 0, bottom: 10, left: 0 }} // Adjust bottom padding if needed
                            // --- Optional: Dark Mode Map Style ---
                            customMapStyle={[ // Example Dark Mode Style (from https://mapstyle.withgoogle.com/)
                                { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
                                { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
                                { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
                                { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
                                { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
                                { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
                                { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
                                { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
                                { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
                                { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
                                { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
                                { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
                                { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
                                { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f3948" }] },
                                { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
                                { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
                                { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
                                { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
                            ]}
                        >
                            {/* User Marker */}
                            {hasUserCoords && (
                                <CustomMarker
                                    coordinate={resultData.userCoords}
                                    title="Your Location"
                                    // Optional: Provide path to your asset
                                    // imageSource={require('../assets/user-pin.png')}
                                    color="#4285F4" // Google Blue
                                />
                            )}
                            {/* Landmark Marker */}
                            {hasLandmarkCoords && (
                                <CustomMarker
                                    coordinate={resultData.landmarkCoords}
                                    title={resultData.landmark}
                                    // Optional: Provide path to your asset
                                    // imageSource={require('../assets/landmark-pin.png')}
                                    color="#DB4437" // Google Red
                                />
                            )}
                            {/* Mock Landmarks */}
                            {mockLandmarks.map((landmark, index) => (
                                <CustomMarker
                                    key={index}
                                    coordinate={landmark.coords}
                                    title={landmark.name}
                                    color="#FFEB3B" // Google Yellow
                                />
                            ))}
                        </MapView>
                        {/* Map loading indicator */}
                        {!mapReady && (
                            <View style={styles.mapLoadingOverlay}>
                                <ActivityIndicator size="large" color="#FFF" />
                            </View>
                        )}
                    </View>
                ) : (
                    <Text style={styles.mapPlaceholder}>Map requires location data for both you and the landmark.</Text>
                )}
            </Animated.View>

            {/* Distance Explanation */}
            <Animated.View style={styles.detailsSection} entering={FadeInDown.duration(400).delay(400)}>
                <Text style={styles.detailsTitle}>Distance Information</Text>
                <Text style={styles.detailsText}>
                    Image Estimate: Distance calculated from image analysis.{"\n\n"}
                    GPS Distance: Precise distance based on your GPS location and the landmark's coordinates.
                </Text>
            </Animated.View>

        </BottomSheetScrollView>
    ), [resultData, canShowMap, hasUserCoords, mapReady, initialRegion, fitMapToMarkers]); // Dependencies for content rendering

    // --- Handle Missing Data ---
    if (!resultData) {
        return (
            <View style={[styles.container, styles.centered]}>
                <StatusBar barStyle="light-content" />
                <Text style={styles.errorText}>Error: Result data missing.</Text>
                {/* Add a simple back button even here */}
                <Pressable onPress={() => navigation.goBack()} style={styles.fallbackBackButton}>
                    <Text style={styles.fallbackBackButtonText}>Go Back</Text>
                </Pressable>
            </View>
        );
    }

    // --- Main Render ---
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <LinearGradient
                // Consistent Blue Gradient from HomeScreen
                colors={['#0052D4', '#4364F7', '#6FB1FC']}
                style={styles.gradientBackground}
            >
                <StatusBar barStyle="light-content" />

                {/* --- Background Image --- */}
                <Animated.View entering={FadeIn.duration(800)}>
                <Image
                    source={{ uri: resultData.processed_image }}
                    style={styles.backgroundImage}
                    resizeMode='cover'
                />
                    {/* Subtle overlay on image */}
                    <View style={styles.imageOverlay} />
                </Animated.View>

                {/* --- Custom Back Button --- */}
                <AnimatedPressable
                    onPress={() => navigation.goBack()}
                    style={styles.backButtonContainer}
                    entering={FadeIn.duration(500).delay(300)} // Fade in after image
                >
                    <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
                </AnimatedPressable>

                {/* --- Bottom Sheet --- */}
                <BottomSheet
                    ref={bottomSheetRef}
                    index={2} // Start at the minimum height
                    snapPoints={snapPoints}
                    handleHeight={BOTTOM_SHEET_HANDLE_HEIGHT}
                    // --- Custom Styling for Handle and Background ---
                    handleIndicatorStyle={styles.bottomSheetHandleIndicator}
                    backgroundStyle={styles.bottomSheetBackground}
                >
                    {renderBottomSheetContent()}
                </BottomSheet>

            </LinearGradient>
        </GestureHandlerRootView>
    );
}

// Reusable AnimatedPressable (if not already global)
const AnimatedPressable = ({ children, onPress, style, entering, ...props }) => (
    <Animated.View entering={entering}>
        <Pressable onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]} {...props}>
            {children}
        </Pressable>
    </Animated.View>
);

// --- Styles ---
const styles = StyleSheet.create({
    // --- Base & Background ---
    gradientBackground: {
        flex: 1,
    },
    backgroundImage: {
        width: width,
        height: IMAGE_HEIGHT,
        resizeMode: 'contain', // Ensure full annotation visibility
        backgroundColor: 'black' // Add background for letterboxed areas
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.25)', // Darken image slightly
        height: IMAGE_HEIGHT, // Match image height
    },
    container: { // Used for error state
        flex: 1,
        backgroundColor: '#1c1f2c', // Dark fallback background
    },
    centered: { // Used for error state
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    // --- Back Button ---
    backButtonContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 55 : 35, // Adjust for status bar
        left: 15,
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        padding: 8,
        borderRadius: 20, // Circular background
    },
    // --- Bottom Sheet Styles ---
    bottomSheetBackground: {
        backgroundColor: '#1E293B', // Dark Slate Blue - Adjust to match theme
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    bottomSheetHandleIndicator: {
        backgroundColor: '#94A3B8', // Lighter slate color for handle
        width: 40,
        height: 5,
    },
    bottomSheetContentContainer: {
        paddingHorizontal: 25,
        paddingBottom: 40, // Ensure space at the bottom
    },
    // --- Content Inside Bottom Sheet ---
    landmarkTitle: {
        fontSize: 26, // Slightly smaller than previous version
        fontWeight: 'bold',
        color: '#F1F5F9', // Off-white
        textAlign: 'center',
        marginTop: 10, // Space above title
        marginBottom: 25, // Space below title
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(148, 163, 184, 0.2)', // Subtle divider
    },
    infoLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 16,
        color: '#94A3B8', // Slate Gray
        marginLeft: 8, // Space between icon and text
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 16,
        color: '#E2E8F0', // Lighter Slate Gray / Off-white
        fontWeight: '600',
    },
    // --- Map Section ---
    mapSectionContainer: {
        marginTop: 15,
    },
    mapTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#CBD5E1', // Medium Slate Gray
        marginBottom: 15,
    },
    mapContainer: {
        width: '100%',
        height: height * 0.4, // Make map taller inside sheet
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: '#334155', // Darker placeholder bg
        position: 'relative', // For loading overlay
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    mapLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 15, // Match container
    },
    mapPlaceholder: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        paddingVertical: 30,
        paddingHorizontal: 10,
        lineHeight: 20,
    },
    // --- Custom Marker ---
    markerImage: {
        width: 35,
        height: 35,
        // Add shadow via parent or wrapper if needed
    },
    markerIconShadow: { // Apply shadow to Ionicons marker
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 3,
    },
    // --- Details Section (Example) ---
    detailsSection: {
        marginTop: 25,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(148, 163, 184, 0.2)',
    },
    detailsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#CBD5E1',
        marginBottom: 10,
    },
    detailsText: {
        fontSize: 15,
        color: '#94A3B8',
        lineHeight: 22,
    },
    // --- Error Styles ---
    errorText: {
        color: '#F87171', // Red accent for error
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
    },
    fallbackBackButton: {
        marginTop: 30,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#4A5568',
        borderRadius: 8,
    },
    fallbackBackButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
