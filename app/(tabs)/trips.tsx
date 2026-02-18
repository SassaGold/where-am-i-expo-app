import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { Waypoint, Route, saveWaypoint, getWaypoints, deleteWaypoint, saveRoute, getRoutes, deleteRoute as deleteRouteFromUtils } from "../../utils/tripUtils";
import { useTheme, Theme } from '../../utils/theme';

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    // @ts-ignore - for web compatibility
    boxShadow: `0 8px 12px ${theme.colors.text}40`,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  bodyText: {
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    marginTop: 4,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    color: theme.colors.text,
    fontSize: 16,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: "600",
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  routeItem: {
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  routeHeader: {
    marginBottom: 8,
  },
  routeName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  routeMeta: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  waypointItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  waypointInfo: {
    flex: 1,
    marginRight: 12,
  },
  waypointName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  waypointMeta: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  waypointNote: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  waypointSelector: {
    maxHeight: 200,
    marginBottom: 12,
  },
  waypointSelectorItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  waypointSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: theme.colors.secondary,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  waypointSelectorInfo: {
    flex: 1,
  },
  waypointActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: theme.colors.secondary,
    minWidth: 36,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
});

export default function TripsScreen() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [routeName, setRouteName] = useState("");
  const [showCreateRoute, setShowCreateRoute] = useState(false);
  const [selectedWaypointIds, setSelectedWaypointIds] = useState<Set<string>>(new Set());

  const { theme } = useTheme();
  const styles = getStyles(theme);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [routesData, waypointsData] = await Promise.all([
        getRoutes(),
        getWaypoints()
      ]);

      setRoutes(routesData);
      setWaypoints(waypointsData);
    } catch (error) {
      console.error("Error loading trip data:", error);
    }
  };

  const addWaypoint = async (waypoint: Omit<Waypoint, 'id'>) => {
    try {
      const newWaypoint = await saveWaypoint(waypoint);
      setWaypoints(prev => [...prev, newWaypoint]);
    } catch (error) {
      Alert.alert("Error", "Failed to save waypoint");
    }
  };

  const removeWaypoint = async (waypointId: string) => {
    console.log("Removing waypoint:", waypointId);
    console.log("Current waypoints ids:", waypoints.map(w => w.id));
    try {
      await deleteWaypoint(waypointId);
      console.log("Waypoint deleted from storage");
      setWaypoints(prev => {
        const filtered = prev.filter(w => w.id !== waypointId);
        console.log("Waypoints before:", prev.length, "after:", filtered.length);
        return filtered;
      });
    } catch (error) {
      console.error("Error deleting waypoint:", error);
      Alert.alert("Error", "Failed to delete waypoint");
    }
  };

  const createRoute = async () => {
    if (!routeName.trim() || selectedWaypointIds.size === 0) {
      Alert.alert("Error", "Please enter a route name and select waypoints");
      return;
    }

    try {
      const selectedWaypoints = waypoints.filter(w => selectedWaypointIds.has(w.id));
      const newRoute = await saveRoute({
        name: routeName.trim(),
        waypoints: selectedWaypoints,
        createdAt: new Date(),
      });

      setRoutes(prev => [...prev, newRoute]);
      setCurrentRoute(null);
      setRouteName("");
      setShowCreateRoute(false);
      setSelectedWaypointIds(new Set());
    } catch (error) {
      Alert.alert("Error", "Failed to save route");
    }
  };

  const deleteRoute = async (routeId: string) => {
    console.log("deleteRoute called with id:", routeId);
    
    if (Platform.OS === 'web') {
      // Use browser confirm for web
      const confirmed = window.confirm("Are you sure you want to delete this route?");
      if (confirmed) {
        console.log("Delete confirmed for route:", routeId);
        try {
          await deleteRouteFromUtils(routeId);
          console.log("Route deleted from storage");
          setRoutes(prev => {
            const filtered = prev.filter(r => r.id !== routeId);
            console.log("Routes before:", prev.length, "after:", filtered.length);
            return filtered;
          });
        } catch (error) {
          console.error("Error deleting route:", error);
          alert("Failed to delete route");
        }
      }
    } else {
      // Use RN Alert for mobile
      Alert.alert(
        "Delete Route",
        "Are you sure you want to delete this route?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              console.log("Delete confirmed for route:", routeId);
              try {
                await deleteRouteFromUtils(routeId);
                console.log("Route deleted from storage");
                setRoutes(prev => {
                  const filtered = prev.filter(r => r.id !== routeId);
                  console.log("Routes before:", prev.length, "after:", filtered.length);
                  return filtered;
                });
              } catch (error) {
                console.error("Error deleting route:", error);
                Alert.alert("Error", "Failed to delete route");
              }
            },
          },
        ]
      );
    }
  };

  const openInNavigation = async (waypoints: Waypoint[]) => {
    if (waypoints.length === 0) return;

    const destination = waypoints[waypoints.length - 1];
    let url = "";

    if (Platform.OS === "ios") {
      // Apple Maps
      if (waypoints.length === 1) {
        url = `maps:///?daddr=${destination.latitude},${destination.longitude}&dirflg=d`;
      } else {
        // Multiple waypoints - use Google Maps on iOS
        const waypointsParam = waypoints.slice(0, -1)
          .map(w => `${w.latitude},${w.longitude}`)
          .join("|");
        url = `comgooglemaps://?daddr=${destination.latitude},${destination.longitude}&waypoints=${waypointsParam}&directionsmode=driving`;
      }
    } else {
      // Android - Google Maps
      if (waypoints.length === 1) {
        url = `google.navigation:q=${destination.latitude},${destination.longitude}&mode=d`;
      } else {
        const waypointsParam = waypoints.slice(0, -1)
          .map(w => `${w.latitude},${w.longitude}`)
          .join("|");
        url = `google.navigation:q=${destination.latitude},${destination.longitude}&waypoints=${waypointsParam}&mode=d`;
      }
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to web URL
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      Alert.alert("Error", "Could not open navigation app");
    }
  };

  const addCurrentLocationAsWaypoint = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location permission is required to add current location");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      await addWaypoint({
        name: "Current Location",
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        category: "current",
      });
      Alert.alert("Success", "Current location added as waypoint");
    } catch (error) {
      Alert.alert("Error", "Could not get current location");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trip Planning</Text>
        <Text style={styles.subtitle}>Plan routes and save waypoints</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.actionButton} onPress={addCurrentLocationAsWaypoint}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text style={styles.actionButtonText}>Add Current Location</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setShowCreateRoute(true)}>
            <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
            <Text style={styles.actionButtonText}>Create Route</Text>
          </Pressable>
        </View>
      </View>

      {/* Create Route Modal */}
      {showCreateRoute && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create New Route</Text>
          <TextInput
            style={styles.input}
            placeholder="Route name"
            placeholderTextColor={theme.colors.textSecondary}
            value={routeName}
            onChangeText={setRouteName}
          />
          <Text style={styles.bodyText}>
            Select waypoints from the list below to include in your route:
          </Text>
          <ScrollView style={styles.waypointSelector} nestedScrollEnabled={true}>
            {waypoints.map((waypoint) => (
              <Pressable
                key={waypoint.id}
                style={[
                  styles.waypointSelectorItem,
                  selectedWaypointIds.has(waypoint.id) && styles.waypointSelected
                ]}
                onPress={() => {
                  const newSelected = new Set(selectedWaypointIds);
                  if (newSelected.has(waypoint.id)) {
                    newSelected.delete(waypoint.id);
                  } else {
                    newSelected.add(waypoint.id);
                  }
                  setSelectedWaypointIds(newSelected);
                }}
              >
                <View style={styles.checkbox}>
                  {selectedWaypointIds.has(waypoint.id) && (
                    <Ionicons name="checkmark" size={16} color="#38bdf8" />
                  )}
                </View>
                <View style={styles.waypointSelectorInfo}>
                  <Text style={styles.waypointName}>{waypoint.name}</Text>
                  <Text style={styles.waypointMeta}>
                    {waypoint.latitude.toFixed(5)}, {waypoint.longitude.toFixed(5)}
                    {waypoint.category && ` • ${waypoint.category}`}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.bodyText}>
            Selected: {selectedWaypointIds.size} waypoint{selectedWaypointIds.size !== 1 ? 's' : ''}
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.secondaryButton, { flex: 1 }]}
              onPress={() => {
                setShowCreateRoute(false);
                setSelectedWaypointIds(new Set());
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, { flex: 1 }]}
              onPress={createRoute}
            >
              <Text style={styles.primaryButtonText}>Create Route</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Saved Routes */}
      {routes.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Saved Routes</Text>
          {routes.map((route) => (
            <View key={route.id} style={styles.routeItem}>
              <View style={styles.routeHeader}>
                <Text style={styles.routeName}>{route.name}</Text>
                <Text style={styles.routeMeta}>
                  {route.waypoints.length} stops • {route.createdAt.toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openInNavigation(route.waypoints)}
                >
                  <Ionicons name="navigate" size={16} color={theme.colors.primary} />
                  <Text style={styles.secondaryButtonText}>Navigate</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => {
                    console.log("Delete route button pressed for id:", route.id);
                    deleteRoute(route.id);
                  }}
                >
                  <Ionicons name="trash" size={16} color="#fca5a5" />
                  <Text style={[styles.secondaryButtonText, { color: "#fca5a5" }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Saved Waypoints */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Saved Waypoints</Text>
        {waypoints.length === 0 ? (
            <Text style={{ color: '#ef4444', fontSize: 15, marginBottom: 8 }}>No waypoints saved yet. Add your current location or save places from other tabs.</Text>
        ) : (
          waypoints.map((waypoint) => (
            <View key={waypoint.id} style={styles.waypointItem}>
              <View style={styles.waypointInfo}>
                <Text style={styles.waypointName}>{waypoint.name}</Text>
                <Text style={styles.waypointMeta}>
                  {waypoint.latitude.toFixed(5)}, {waypoint.longitude.toFixed(5)}
                  {waypoint.category && ` • ${waypoint.category}`}
                </Text>
                {waypoint.note && <Text style={styles.waypointNote}>{waypoint.note}</Text>}
              </View>
              <View style={styles.waypointActions}>
                <Pressable
                  style={styles.iconButton}
                  onPress={() => openInNavigation([waypoint])}
                >
                  <Ionicons name="navigate" size={20} color={theme.colors.primary} />
                </Pressable>
                <Pressable
                  style={styles.iconButton}
                  onPress={() => {
                    console.log("Delete waypoint pressed for id:", waypoint.id);
                    Alert.alert(
                      "Delete Waypoint",
                      "Are you sure you want to delete this waypoint?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => removeWaypoint(waypoint.id)
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="trash" size={20} color={theme.colors.error} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}