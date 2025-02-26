import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { format, addDays, subDays } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AddEntryModal from '../../components/AddEntryModal';
import { useRouter } from 'expo-router';

interface DayData {
  foodEntries: Array<{
    id: string;
    name: string;
    time: number;
  }>;
  workoutDone: boolean;
  workoutNote: string;
  moodRating: number;
  moodNote: string;
}

interface FoodEntryProps {
  item: {
    id: string;
    name: string;
    time: number;
  };
  onDelete: (id: string) => void;
  onEdit: (item: { id: string; name: string; time: number }) => void;
}

interface MoodSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

const FoodEntry: React.FC<FoodEntryProps> = ({ item, onDelete, onEdit }) => (
  <View style={styles.foodCard}>
    <View style={styles.foodCardContent}>
      <View style={styles.foodInfo}>
        <Text style={styles.foodTime}>{format(new Date(item.time), 'HH:mm')}</Text>
        <Text style={styles.foodName}>{item.name}</Text>
      </View>
      <View style={styles.foodActions}>
        <Pressable
          onPress={() => onEdit(item)}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.buttonPressed,
          ]}>
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => onDelete(item.id)}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.buttonPressed,
          ]}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  </View>
);

const MOOD_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
}));

const MoodSelector: React.FC<MoodSelectorProps> = ({ value, onChange }) => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Pressable
        style={styles.moodSelectorButton}
        onPress={() => setModalVisible(true)}>
        <Text style={styles.moodValueNumber}>{value}</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.moodModalContent}>
            <Text style={styles.moodModalTitle}>Select Mood (1-10)</Text>
            <ScrollView 
              style={styles.moodOptionsList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.moodOptionsContainer}>
              {MOOD_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.moodOption,
                    value === option.value && styles.moodOptionSelected,
                  ]}
                  onPress={() => {
                    onChange(option.value);
                    setModalVisible(false);
                  }}>
                  <Text
                    style={[
                      styles.moodOptionNumber,
                      value === option.value && styles.moodOptionTextSelected,
                    ]}>
                    {option.value}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={styles.moodModalCloseButton}
              onPress={() => setModalVisible(false)}>
              <Text style={styles.moodModalCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default function DailyLog() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workoutDone, setWorkoutDone] = useState(false);
  const [workoutNote, setWorkoutNote] = useState('');
  const [moodRating, setMoodRating] = useState(5);
  const [moodNote, setMoodNote] = useState('');
  const [foodEntries, setFoodEntries] = useState<Array<{
    id: string;
    name: string;
    time: number;
  }>>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const getStorageKey = useCallback((date: Date) => {
    return `dayData_${format(date, 'yyyy-MM-dd')}`;
  }, []);

  const loadDayData = useCallback(async (date: Date) => {
    try {
      const key = getStorageKey(date);
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const dayData: DayData = JSON.parse(data);
        setFoodEntries(dayData.foodEntries);
        setWorkoutDone(dayData.workoutDone);
        setWorkoutNote(dayData.workoutNote);
        setMoodRating(dayData.moodRating);
        setMoodNote(dayData.moodNote);
      } else {
        setFoodEntries([]);
        setWorkoutDone(false);
        setWorkoutNote('');
        setMoodRating(5);
        setMoodNote('');
      }
    } catch (error) {
      console.error('Error loading day data:', error);
    }
  }, [getStorageKey]);

  const saveDayData = useCallback(async () => {
    try {
      const key = getStorageKey(selectedDate);
      const dayData: DayData = {
        foodEntries,
        workoutDone,
        workoutNote,
        moodRating,
        moodNote,
      };
      await AsyncStorage.setItem(key, JSON.stringify(dayData));
    } catch (error) {
      console.error('Error saving day data:', error);
    }
  }, [selectedDate, foodEntries, workoutDone, workoutNote, moodRating, moodNote, getStorageKey]);

  useEffect(() => {
    loadDayData(selectedDate);
  }, [selectedDate, loadDayData]);

  useEffect(() => {
    saveDayData();
  }, [foodEntries, workoutDone, workoutNote, moodRating, moodNote, saveDayData]);

  const handleDateChange = useCallback((days: number) => {
    setSelectedDate(current => days > 0 ? addDays(current, days) : subDays(current, Math.abs(days)));
  }, []);

  const handleDeleteFood = useCallback((id: string) => {
    setFoodEntries(current => current.filter(entry => entry.id !== id));
  }, []);

  const handleEditFood = useCallback((entry: { id: string; name: string; time: number }) => {
    setEditingEntry(entry);
    setModalVisible(true);
  }, []);

  const handleSaveEntry = useCallback((entry: { name: string; time: number }) => {
    const entryTime = new Date(entry.time);
    const adjustedTime = new Date(selectedDate);
    adjustedTime.setHours(entryTime.getHours());
    adjustedTime.setMinutes(entryTime.getMinutes());

    if (editingEntry) {
      setFoodEntries(current =>
        current.map(item =>
          item.id === editingEntry.id
            ? { ...item, name: entry.name, time: adjustedTime.getTime() }
            : item
        )
      );
      setEditingEntry(null);
    } else {
      const newEntry = {
        id: Date.now().toString(),
        name: entry.name,
        time: adjustedTime.getTime(),
      };
      setFoodEntries(current => [...current, newEntry].sort((a, b) => a.time - b.time));
    }
  }, [editingEntry, selectedDate]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingEntry(null);
  }, []);

  const updateMoodStats = useCallback(async () => {
    router.push('/stats');
    router.back();
  }, [router]);

  const handleMoodChange = useCallback((newMoodRating: number) => {
    setMoodRating(newMoodRating);
    setTimeout(updateMoodStats, 100);
  }, [updateMoodStats]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Food Diary</Text>
        </View>
        <View style={styles.dateContainer}>
          <Pressable
            onPress={() => handleDateChange(-1)}
            style={({ pressed }) => [
              styles.dateButton,
              pressed && styles.buttonPressed,
            ]}>
            <ChevronLeft size={24} color="#007AFF" />
          </Pressable>
          <Text style={styles.dateText}>
            {format(selectedDate, 'dd MMM yyyy')}
          </Text>
          <Pressable
            onPress={() => handleDateChange(1)}
            style={({ pressed }) => [
              styles.dateButton,
              pressed && styles.buttonPressed,
            ]}>
            <ChevronRight size={24} color="#007AFF" />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Food Log</Text>
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setModalVisible(true)}>
              <Plus size={18} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.foodList}>
            {foodEntries.map(entry => (
              <FoodEntry
                key={entry.id}
                item={entry}
                onDelete={handleDeleteFood}
                onEdit={handleEditFood}
              />
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.compactSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Workout</Text>
            <Pressable
              onPress={() => setWorkoutDone(!workoutDone)}
              style={styles.checkbox}>
              <View
                style={[
                  styles.checkboxInner,
                  workoutDone && styles.checkboxChecked,
                ]}
              />
            </Pressable>
          </View>
          {workoutDone && (
            <TextInput
              style={styles.workoutNote}
              placeholder="Add workout details..."
              value={workoutNote}
              onChangeText={setWorkoutNote}
              multiline
              maxLength={200}
            />
          )}
        </View>

        <View style={[styles.section, styles.compactSection]}>
          <View style={styles.moodContainer}>
            <View style={styles.moodRow}>
              <Text style={styles.sectionTitle}>Mood</Text>
              <MoodSelector value={moodRating} onChange={handleMoodChange} />
            </View>
            <TextInput
              style={styles.moodNote}
              placeholder="How are you feeling today?"
              value={moodNote}
              onChangeText={setMoodNote}
              multiline
            />
          </View>
        </View>
      </ScrollView>

      <AddEntryModal
        visible={modalVisible}
        onClose={handleCloseModal}
        onSave={handleSaveEntry}
        initialEntry={editingEntry}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    paddingTop: 16,
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  dateButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  dateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    backgroundColor: '#FFF',
    marginBottom: 12,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  compactSection: {
    padding: 12,
    marginBottom: 10,
    marginTop: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  foodList: {
    gap: 8,
  },
  foodCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    overflow: 'hidden',
  },
  foodCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  foodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    marginLeft: 12,
    flex: 1,
  },
  foodTime: {
    fontSize: 13,
    color: '#666',
    minWidth: 45,
  },
  foodActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FF3B30',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  workoutNote: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    minHeight: 60,
    fontSize: 15,
  },
  moodContainer: {
    width: '100%',
  },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  moodSelectorButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  moodValueNumber: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  moodNote: {
    width: '100%',
    padding: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    minHeight: 40,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  moodModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  moodModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000',
    textAlign: 'center',
  },
  moodOptionsList: {
    maxHeight: 300,
  },
  moodOptionsContainer: {
    paddingBottom: 8,
  },
  moodOption: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  moodOptionSelected: {
    backgroundColor: '#007AFF',
  },
  moodOptionNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  moodOptionTextSelected: {
    color: '#FFF',
  },
  moodModalCloseButton: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  moodModalCloseButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
});