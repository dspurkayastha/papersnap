// mobile/src/screens/DocumentReviewScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  Button,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { api } from '../api/client';

type Props = NativeStackScreenProps<AppStackParamList, 'DocumentReview'>;

type OcrStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

type OcrResponse = {
  id: string;
  ocrStatus: OcrStatus;
  rawText?: string | null;
  parsedFields?: Record<string, any> | null;
  verifiedFields?: Record<string, any> | null;
  schemaType?: string | null;
};

const DocumentReviewScreen: React.FC<Props> = ({ route, navigation }) => {
  const { documentId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('PENDING');
  const [rawText, setRawText] = useState('');
  const [schemaType, setSchemaType] = useState<string | null>(null);

  const [surgeryDate, setSurgeryDate] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientSex, setPatientSex] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [procedure, setProcedure] = useState('');
  const [surgeon, setSurgeon] = useState('');
  const [emergencyFlag, setEmergencyFlag] = useState<boolean | null>(null);
  const [initialEmergencyFlag, setInitialEmergencyFlag] = useState<boolean | null>(null);
  const [emergencyFlagTouched, setEmergencyFlagTouched] = useState(false);

  const resolveFieldValue = (
    key: string,
    verified?: Record<string, any> | null,
    parsed?: Record<string, any> | null
  ) => {
    // 1) Prefer verified
    if (verified && verified[key] !== undefined && verified[key] !== null) {
      return verified[key];
    }

    // 2) Fallback to parsed; support { value: ... } or plain
    const parsedCandidate = parsed ? parsed[key] : undefined;
    if (parsedCandidate && typeof parsedCandidate === 'object' && 'value' in parsedCandidate) {
      return (parsedCandidate as any).value;
    }

    return parsedCandidate ?? '';
  };

  const fetchOcrDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<OcrResponse>(`/documents/${documentId}/ocr`);
      const data = response.data;

      setOcrStatus(data.ocrStatus);
      setRawText(data.rawText ?? '');
      setSchemaType(data.schemaType ?? null);

      const verified = data.verifiedFields ?? undefined;
      const parsed = data.parsedFields ?? undefined;

      const surgeryDateValue = resolveFieldValue('surgeryDate', verified, parsed);
      setSurgeryDate(surgeryDateValue ? String(surgeryDateValue) : '');

      const patientAgeValue = resolveFieldValue('patientAge', verified, parsed);
      setPatientAge(
        patientAgeValue !== undefined &&
          patientAgeValue !== null &&
          patientAgeValue !== ''
          ? String(patientAgeValue)
          : ''
      );

      const patientSexValue = resolveFieldValue('patientSex', verified, parsed);
      setPatientSex(patientSexValue ? String(patientSexValue) : '');

      const diagnosisValue = resolveFieldValue('diagnosis', verified, parsed);
      setDiagnosis(diagnosisValue ? String(diagnosisValue) : '');

      const procedureValue = resolveFieldValue('procedure', verified, parsed);
      setProcedure(procedureValue ? String(procedureValue) : '');

      const surgeonValue = resolveFieldValue('surgeon', verified, parsed);
      setSurgeon(surgeonValue ? String(surgeonValue) : '');

      const emergencyValue = resolveFieldValue('emergencyFlag', verified, parsed);
      const emergencyBoolean = typeof emergencyValue === 'boolean' ? emergencyValue : null;
      setEmergencyFlag(emergencyBoolean ?? false);
      setInitialEmergencyFlag(emergencyBoolean);
      setEmergencyFlagTouched(emergencyBoolean !== null);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Unable to load document.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [documentId, navigation]);

  useEffect(() => {
    fetchOcrDetails();
  }, [fetchOcrDetails]);

  const handleSave = async () => {
    if (ocrStatus !== 'COMPLETED') {
      Alert.alert('OCR Pending', 'OCR must be completed before verification.');
      return;
    }

    const payload: Record<string, unknown> = {};

    if (surgeryDate.trim()) {
      payload.surgeryDate = surgeryDate.trim();
    }

    if (patientAge.trim()) {
      const parsedAge = Number(patientAge.trim());
      if (!Number.isFinite(parsedAge) || parsedAge < 0) {
        Alert.alert('Invalid Age', 'Please enter a valid non-negative age.');
        return;
      }
      payload.patientAge = Math.round(parsedAge);
    }

    if (patientSex.trim()) {
      payload.patientSex = patientSex.trim();
    }

    if (diagnosis.trim()) {
      payload.diagnosis = diagnosis.trim();
    }

    if (procedure.trim()) {
      payload.procedure = procedure.trim();
    }

    if (surgeon.trim()) {
      payload.surgeon = surgeon.trim();
    }

    if (emergencyFlagTouched || initialEmergencyFlag !== null) {
      payload.emergencyFlag = emergencyFlag ?? false;
    }

    if (Object.keys(payload).length === 0) {
      Alert.alert('No Changes', 'Please review and adjust at least one field before saving.');
      return;
    }

    try {
      setSaving(true);
      await api.patch(`/documents/${documentId}/verify`, payload);
      Alert.alert('Success', 'Document verified.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to save verification.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (ocrStatus !== 'COMPLETED') {
    return (
      <View style={styles.centered}>
        <Text style={styles.statusText}>OCR not completed yet.</Text>
        <Button title="Go Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const allowStructuredReview =
    schemaType === 'surgery_note_v1' || schemaType === null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {schemaType ? (
        <Text style={styles.schemaText}>Detected schema: {schemaType}</Text>
      ) : (
        <Text style={styles.schemaText}>Detected schema: Unknown</Text>
      )}

      {!allowStructuredReview ? (
        <Text style={styles.noticeText}>
          Structured review fields may be limited for this document type. You can still edit any
          relevant values below.
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>Verify Fields</Text>

      <TextInput
        style={styles.input}
        placeholder="Surgery Date (YYYY-MM-DD)"
        value={surgeryDate}
        onChangeText={setSurgeryDate}
      />
      <TextInput
        style={styles.input}
        placeholder="Patient Age"
        keyboardType="numeric"
        value={patientAge}
        onChangeText={setPatientAge}
      />
      <TextInput
        style={styles.input}
        placeholder="Patient Sex"
        value={patientSex}
        onChangeText={setPatientSex}
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Diagnosis"
        value={diagnosis}
        onChangeText={setDiagnosis}
        multiline
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Procedure"
        value={procedure}
        onChangeText={setProcedure}
        multiline
      />
      <TextInput
        style={styles.input}
        placeholder="Surgeon"
        value={surgeon}
        onChangeText={setSurgeon}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Emergency Case</Text>
        <Switch
          value={emergencyFlag ?? false}
          onValueChange={(value) => {
            setEmergencyFlag(value);
            setEmergencyFlagTouched(true);
          }}
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title={saving ? 'Saving...' : 'Save Verification'}
          onPress={handleSave}
          disabled={saving}
        />
      </View>

      {rawText ? (
        <View style={styles.rawTextContainer}>
          <Text style={styles.sectionTitle}>Raw OCR Text</Text>
          <Text style={styles.rawText}>{rawText}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  schemaText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    color: '#8a6d3b',
    backgroundColor: '#fff4e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  switchLabel: {
    fontSize: 16,
  },
  buttonContainer: {
    marginBottom: 24,
  },
  rawTextContainer: {
    marginTop: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  rawText: {
    fontSize: 14,
    color: '#333',
  },
  statusText: {
    fontSize: 16,
    marginBottom: 16,
  },
});

export default DocumentReviewScreen;

