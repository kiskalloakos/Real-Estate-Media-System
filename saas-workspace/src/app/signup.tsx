import { Redirect } from 'expo-router';
import { useApp } from '@/providers/app-provider';
import { SignupScreen } from '@/screens/login/signup-screen';

export default function SignupRoute() {
  const { authReady, identity, isPreview } = useApp();
  if (authReady && identity && !isPreview) {
    return <Redirect href={identity.mustResetPassword ? '/reset-password' : '/(portal)/(home)'} />;
  }
  return <SignupScreen />;
}
