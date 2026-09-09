import { useRouter } from 'expo-router';

import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import { ReviewsNativeScreen } from '@/screens/native';

export default function ReviewsRoute() {
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  if (!identity) {
    return null;
  }
  const role = identity.role;

  return (
    <ReviewsNativeScreen
      role={role}
      {...live.bundle.reviews}
      errorMessage={live.errorMessage}
      loading={live.loading}
      locale={identity.locale}
      onPressReview={(review) =>
        router.push({
          pathname: '/(portal)/(reviews)/[reviewId]',
          params: { reviewId: review.id },
        })
      }
      onRefresh={() => void live.retry()}
      onRetry={() => void live.retry()}
      refreshing={live.refreshing}
    />
  );
}
