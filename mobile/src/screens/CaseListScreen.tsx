import React, { useCallback, useLayoutEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AppStackParamList } from '../navigation/AppNavigator';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

type Case = {
  id: string;
  diagnosis: string | null;
  surgeryDate: string | null;
};

type Props = NativeStackScreenProps<AppStackParamList, 'CaseList'>;

const CaseListScreen: React.FC<Props> = ({ navigation }) => {
  const { logout } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCases = useCallback(async () => {
    try {
      const response = await api.get<Case[]>('/cases');
      setCases(response.data);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Unable to load cases.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCases();
    }, [fetchCases])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleCreateCase} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>New Case</Text>
        </TouchableOpacity>
      ),
      headerLeft: () => (
        <TouchableOpacity onPress={logout} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Logout</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, logout]);

  const handleCreateCase = async () => {
    try {
      const response = await api.post<Case>('/cases');
      const newCase = response.data;
      setCases((prev) => [newCase, ...prev]);
      navigation.navigate('CaseDetail', { caseId: newCase.id });
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Unable to create case.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCases();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Case }) => {
    const subtitle = item.diagnosis || '(no diagnosis yet)';
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })}>
        <Text style={styles.cardTitle}>{subtitle}</Text>
        {item.surgeryDate ? <Text style={styles.cardSubtitle}>{new Date(item.surgeryDate).toDateString()}</Text> : null}
        <Text style={styles.cardId}>{item.id}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={cases}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={cases.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.emptyText}>No cases yet. Create one to get started.</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cardId: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
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
  headerButton: {
    marginHorizontal: 8,
  },
  headerButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default CaseListScreen;
