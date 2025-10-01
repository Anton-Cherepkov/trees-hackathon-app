import { Tabs } from 'expo-router';
import { TreePine, Camera, Settings, BookOpen } from 'lucide-react-native';
import { Platform, Text } from 'react-native';

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
          title: 'Деревья',
          tabBarIcon: ({ size, color }) => (
            <TreePine size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Съёмка',
          tabBarIcon: ({ size, color, focused }) => (
            <Camera size={size} color={focused ? "#ef4444" : "#fca5a5"} />
          ),
          tabBarLabel: ({ focused, children }) => (
            <Text style={{ 
              fontWeight: 'bold', 
              color: focused ? "#ef4444" : "#fca5a5",
              fontSize: 12,
            }}>
              {children}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="instructions"
        options={{
          title: 'Инструкция',
          tabBarIcon: ({ size, color }) => (
            <BookOpen size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Настройки',
          tabBarIcon: ({ size, color }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}