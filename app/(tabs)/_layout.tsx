import { Tabs } from 'expo-router';
import { TreePine, Camera, Settings } from 'lucide-react-native';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? 24 : 8,
          height: Platform.OS === 'android' ? 80 : 60,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trees',
          tabBarIcon: ({ size, color }) => (
            <TreePine size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capture',
          tabBarIcon: ({ size, color }) => (
            <Camera size={size} color={color} />
          ),
          tabBarLabelStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}