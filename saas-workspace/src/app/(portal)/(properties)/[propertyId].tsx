import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import {
  NativeEmptyState,
  NativeScreen,
} from '@/components/native';
import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import { PropertyDetailNativeScreen } from '@/screens/native';

export default function PropertyDetailRoute() {
  const params = useLocalSearchParams<{
    propertyId: string | string[];
  }>();
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  const propertyId = Array.isArray(params.propertyId)
    ? params.propertyId[0]
    : params.propertyId;
  const property = live.bundle.properties.properties.find(
    (item) => item.id === propertyId,
  );
  const portalProperty = live.data?.properties?.find(
    (item) => item.id === propertyId,
  );

  if (!identity) {
    return null;
  }

  if (!property) {
    return (
      <>
        <NativeScreen
          errorMessage={live.errorMessage}
          loading={live.loading}
          loadingLabel="Loading property"
          onRefresh={() => void live.retry()}
          onRetry={() => void live.retry()}
          refreshing={live.refreshing}
        >
          <NativeEmptyState
            message="This property is no longer available to your account."
            symbol="building.2.crop.circle"
            title="Property unavailable"
          />
        </NativeScreen>
        <Stack.Title>Property</Stack.Title>
      </>
    );
  }

  const tasks = (live.data?.tasks ?? []).filter(
    (task) => task.propertyId === property.id,
  );
  const reviews = live.bundle.reviews.reviews.filter(
    (review) => review.propertyName === property.name,
  );
  const events = live.bundle.calendar.events.filter(
    (event) => event.propertyName === property.name,
  );

  return (
    <>
      <PropertyDetailNativeScreen
        errorMessage={live.errorMessage}
        events={events}
        loading={live.loading}
        onPressEvent={(eventId) =>
          router.push({
            pathname: '/(portal)/(calendar)/[eventId]',
            params: { eventId },
          })
        }
        onPressReview={(reviewId) =>
          router.push({
            pathname: '/(portal)/(reviews)/[reviewId]',
            params: { reviewId },
          })
        }
        onRefresh={() => void live.retry()}
        onRetry={() => void live.retry()}
        portalProperty={portalProperty}
        property={property}
        refreshing={live.refreshing}
        reviews={reviews}
        tasks={tasks}
        locale={identity.locale}
      />
      <Stack.Title>{property.name}</Stack.Title>
    </>
  );
}
