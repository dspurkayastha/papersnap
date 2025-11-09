import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { api } from '../api/client';

type Engine = {
  id: string;
  name: string;
  enabled: boolean;
  available: boolean;
  reason?: string | null;
};

type Props = NativeStackScreenProps<AppStackParamList, 'Settings'>;

const SettingsScreen: React.FC<Props> = () => {
  const [engines, setEngines] = useState<Engine[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingEngine, setUpdatingEngine] = useState<string | null>(null);

  const fetchEngines = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ engines?: Engine[] }>('/settings/ocr-engines');
      setEngines(response.data.engines ?? []);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Unable to load OCR engines.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchEngines();
    }, [fetchEngines])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEngines();
    setRefreshing(false);
  }, [fetchEngines]);

  const handleToggle = async (engine: Engine, value: boolean) => {
    setUpdatingEngine(engine.id);
    try {
      const response = await api.post<{ engines?: Engine[] }>(
        `/settings/ocr-engines/${engine.id}`,
        { enabled: value }
      );
      setEngines(response.data.engines ?? []);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Unable to update engine.');
    } finally {
      setUpdatingEngine(null);
    }
  };

  const renderItem = ({ item }: { item: Engine }) => {
    const disabled = !item.available;
    const statusLabel = item.available ? 'Available' : 'Unavailable';
    const statusStyle = item.available ? styles.statusAvailable : styles.statusUnavailable;
    const switchDisabled = disabled || updatingEngine === item.id;

    return (
      <View style={styles.engineRow}>
        <View style={styles.engineInfo}>
          <Text style={styles.engineName}>{item.name}</Text>
          <Text style={[styles.engineStatus, statusStyle]}>{statusLabel}</Text>
          {item.reason && !item.available ? (
            <Text style={styles.engineReason}>{item.reason}</Text>
          ) : null}
        </View>
        <Switch
          value={item.enabled}
          onValueChange={(value) => handleToggle(item, value)}
          disabled={switchDisabled}
        />
      </View>
    );
  };

  if (loading && engines.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={engines}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={engines.length === 0 ? styles.emptyContainer : styles.listContent}
      ListEmptyComponent={<Text style={styles.emptyText}>No OCR engines reported.</Text>}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  listContent: {
    padding: 16,
  },
  engineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  engineInfo: {
    flex: 1,
    paddingRight: 12,
  },
  engineName: {
    fontSize: 16,
    fontWeight: '600',
  },
  engineStatus: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  statusAvailable: {
    color: '#34C759',
  },
  statusUnavailable: {
    color: '#FF3B30',
  },
  engineReason: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#666',
  },
});

export default SettingsScreen;
