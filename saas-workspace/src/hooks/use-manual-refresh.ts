import React from 'react';

export function useManualRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return { refresh, refreshing };
}
