import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import CaseListScreen from '../screens/CaseListScreen';
import CaseDetailScreen from '../screens/CaseDetailScreen';
import CaptureUploadScreen from '../screens/CaptureUploadScreen';

export type AppStackParamList = {
  CaseList: undefined;
  CaseDetail: { caseId: string };
  CaptureUpload: { caseId: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const AppNavigator: React.FC = () => {
  const { token } = useAuth();

  if (!token) {
    return (
      <AuthStack.Navigator>
        <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
        <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
      </AuthStack.Navigator>
    );
  }

  return (
    <AppStack.Navigator>
      <AppStack.Screen name="CaseList" component={CaseListScreen} options={{ title: 'Cases' }} />
      <AppStack.Screen name="CaseDetail" component={CaseDetailScreen} options={{ title: 'Case Details' }} />
      <AppStack.Screen name="CaptureUpload" component={CaptureUploadScreen} options={{ title: 'Add Document' }} />
    </AppStack.Navigator>
  );
};

export default AppNavigator;
