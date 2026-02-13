import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type Waypoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  note?: string;
};

export type Route = {
  id: string;
  name: string;
  waypoints: Waypoint[];
  createdAt: Date;
};

const STORAGE_KEY_WAYPOINTS = "saved_waypoints";
const STORAGE_KEY_ROUTES = "trip_routes";

// Web-compatible storage wrapper
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error("Error accessing localStorage:", error);
        return null;
      }
    }
    return await AsyncStorage.getItem(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error("Error setting localStorage:", error);
      }
      return;
    }
    await AsyncStorage.setItem(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error("Error removing from localStorage:", error);
      }
      return;
    }
    await AsyncStorage.removeItem(key);
  }
};

export const saveWaypoint = async (waypoint: Omit<Waypoint, 'id'>) => {
  try {
    const existingData = await storage.getItem(STORAGE_KEY_WAYPOINTS);
    const waypoints: Waypoint[] = existingData ? JSON.parse(existingData) : [];

    const newWaypoint: Waypoint = {
      ...waypoint,
      id: Date.now().toString(),
    };

    waypoints.push(newWaypoint);
    await storage.setItem(STORAGE_KEY_WAYPOINTS, JSON.stringify(waypoints));

    return newWaypoint;
  } catch (error) {
    console.error("Error saving waypoint:", error);
    throw error;
  }
};

export const getWaypoints = async (): Promise<Waypoint[]> => {
  try {
    const data = await storage.getItem(STORAGE_KEY_WAYPOINTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error loading waypoints:", error);
    return [];
  }
};

export const deleteWaypoint = async (waypointId: string) => {
  try {
    const existingData = await storage.getItem(STORAGE_KEY_WAYPOINTS);
    const waypoints: Waypoint[] = existingData ? JSON.parse(existingData) : [];

    const filteredWaypoints = waypoints.filter(w => w.id !== waypointId);
    await storage.setItem(STORAGE_KEY_WAYPOINTS, JSON.stringify(filteredWaypoints));
  } catch (error) {
    console.error("Error deleting waypoint:", error);
    throw error;
  }
};

export const saveRoute = async (route: Omit<Route, 'id'>) => {
  try {
    const existingData = await storage.getItem(STORAGE_KEY_ROUTES);
    const routes: Route[] = existingData ? JSON.parse(existingData) : [];

    const newRoute: Route = {
      ...route,
      id: Date.now().toString(),
    };

    routes.push(newRoute);
    await storage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(routes));

    return newRoute;
  } catch (error) {
    console.error("Error saving route:", error);
    throw error;
  }
};

export const getRoutes = async (): Promise<Route[]> => {
  try {
    const data = await storage.getItem(STORAGE_KEY_ROUTES);
    const routes = data ? JSON.parse(data) : [];
    // Convert createdAt strings back to Date objects
    return routes.map((route: any) => ({
      ...route,
      createdAt: new Date(route.createdAt),
    }));
  } catch (error) {
    console.error("Error loading routes:", error);
    return [];
  }
};

export const deleteRoute = async (routeId: string) => {
  try {
    const existingData = await storage.getItem(STORAGE_KEY_ROUTES);
    const routes: Route[] = existingData ? JSON.parse(existingData) : [];

    const filteredRoutes = routes.filter(r => r.id !== routeId);
    await storage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(filteredRoutes));
  } catch (error) {
    console.error("Error deleting route:", error);
    throw error;
  }
};