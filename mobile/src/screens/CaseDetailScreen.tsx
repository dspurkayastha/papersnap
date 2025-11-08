import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AppStackParamList } from '../navigation/AppNavigator';
import { api } from '../api/client';

type Document = {
  id: string;
  type: string;
  ocrStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
  isVerified: boolean;
  verifiedFields?: Record<string, unknown> | null;
};

type CaseDetail = {
  id: string;
  diagnosis: string | null;
  procedure: string | null;
  surgeon: string | null;
  surgeryDate: string | null;
  documents: Document[];
};

type Props = NativeStackScreenProps<AppStackParamList, 'CaseDetail'>;

const CaseDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { caseId } = route.params;
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCase = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<CaseDetail>(`/cases/${caseId}`);
      setCaseDetail(response.data);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Unable to load case.');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useFocusEffect(
    useCallback(() => {
      fetchCase();
    }, [fetchCase])
  );

  const handleViewOcr = async (documentId: string) => {
    try {
      const response = await api.get<{ id: string; ocrStatus: string; rawText?: string }>(`/documents/${documentId}/ocr`);
      const { ocrStatus, rawText } = response.data;
      let message = ocrStatus;
      if (ocrStatus === 'COMPLETED') {
        const text = rawText ? rawText.slice(0, 300) : 'No raw text available.';
        message = `${ocrStatus}\n\n${text}${rawText && rawText.length > 300 ? '...' : ''}`;
      }
      Alert.alert('OCR Status', message);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Unable to fetch OCR results.');
    }
  };

  const statusStyle = (status: Document['ocrStatus']) => {
    switch (status) {
      case 'COMPLETED':
        return styles.statusCompleted;
      case 'FAILED':
        return styles.statusFailed;
      default:
        return styles.statusPending;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {caseDetail ? (
        <View>
          <Text style={styles.title}>{caseDetail.diagnosis || 'Untitled Case'}</Text>
          {caseDetail.surgeryDate ? (
            <Text style={styles.subtitle}>Surgery Date: {new Date(caseDetail.surgeryDate).toDateString()}</Text>
          ) : null}
          {caseDetail.procedure ? <Text style={styles.subtitle}>Procedure: {caseDetail.procedure}</Text> : null}
          {caseDetail.surgeon ? <Text style={styles.subtitle}>Surgeon: {caseDetail.surgeon}</Text> : null}

          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('CaptureUpload', { caseId })}>
            <Text style={styles.addButtonText}>Add Document</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Documents</Text>
          {caseDetail.documents.length === 0 ? (
            <Text>No documents uploaded yet.</Text>
          ) : (
            caseDetail.documents.map((doc) => (
              <View key={doc.id} style={styles.documentCard}>
                <View style={styles.documentHeader}>
                  <Text style={styles.documentTitle}>{doc.type}</Text>
                  {doc.isVerified ? <Text style={styles.verifiedBadge}>Verified</Text> : null}
                </View>
                <Text style={[styles.documentStatus, statusStyle(doc.ocrStatus)]}>{doc.ocrStatus}</Text>
                <View style={styles.documentActions}>
                  <TouchableOpacity style={styles.ocrButton} onPress={() => handleViewOcr(doc.id)}>
                    <Text style={styles.ocrButtonText}>View OCR</Text>
                  </TouchableOpacity>
                  {doc.ocrStatus === 'COMPLETED' && caseDetail ? (
                    <TouchableOpacity
                      style={[styles.ocrButton, styles.reviewButton]}
                      onPress={() =>
                        navigation.navigate('DocumentReview', {
                          documentId: doc.id,
                          caseId: caseDetail.id,
                        })
                      }
                    >
                      <Text style={styles.reviewButtonText}>{doc.isVerified ? 'Edit Review' : 'Review'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      ) : (
        <Text>{loading ? 'Loading...' : 'Case not found.'}</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  documentCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  verifiedBadge: {
    backgroundColor: '#34C759',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  documentStatus: {
    marginTop: 4,
    fontWeight: '600',
  },
  statusPending: {
    color: '#FF9500',
  },
  statusCompleted: {
    color: '#34C759',
  },
  statusFailed: {
    color: '#FF3B30',
  },
  documentActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  ocrButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#5856D6',
    marginRight: 8,
  },
  ocrButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  reviewButton: {
    backgroundColor: '#34C759',
  },
  reviewButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default CaseDetailScreen;
