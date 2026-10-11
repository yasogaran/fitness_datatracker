// Custom entry: the background location task must be defined before the app renders,
// including when Android starts the JS runtime headless for a location update.
import './src/services/locationTask';
import 'expo-router/entry';
