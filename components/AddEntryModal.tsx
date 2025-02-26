import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  I18nManager,
} from 'react-native';
import { Clock } from 'lucide-react-native';

// Hebrew translations
const translations = {
  addEntry: 'הוסף מאכל',
  editEntry: 'ערוך מאכל',
  foodName: 'שם המאכל',
  enterFoodName: 'הכנס שם מאכל',
  customTime: 'בחר שעה',
  cancel: 'ביטול',
  save: 'שמור',
  pleaseEnterFood: 'אנא הכנס שם מאכל',
  pleaseEnterValidTime: 'אנא הכנס שעה תקינה',
};

interface AddEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: { name: string; time: Date }) => void;
  initialEntry?: { name: string; time: number } | null;
}

export default function AddEntryModal({
  visible,
  onClose,
  onSave,
  initialEntry,
}: AddEntryModalProps) {
  const [name, setName] = useState('');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      if (initialEntry) {
        const date = new Date(initialEntry.time);
        setName(initialEntry.name);
        setHours(date.getHours().toString().padStart(2, '0'));
        setMinutes(date.getMinutes().toString().padStart(2, '0'));
        setUseCustomTime(true);
      } else {
        const now = new Date();
        setName('');
        setHours(now.getHours().toString().padStart(2, '0'));
        setMinutes(now.getMinutes().toString().padStart(2, '0'));
        setUseCustomTime(false);
      }
      setError('');
    }
  }, [visible, initialEntry]);

  const handleSave = () => {
    if (!name.trim()) {
      setError('Please enter a food name');
      return;
    }

    let time = new Date();
    if (useCustomTime) {
      const currentHours = parseInt(hours, 10);
      const currentMinutes = parseInt(minutes, 10);
      
      if (isNaN(currentHours) || currentHours < 0 || currentHours > 23 ||
          isNaN(currentMinutes) || currentMinutes < 0 || currentMinutes > 59) {
        setError('Please enter valid time');
        return;
      }

      time.setHours(currentHours, currentMinutes);
    }

    onSave({ name, time });
    onClose();
  };

  const handleTimeChange = (text: string, isHours: boolean) => {
    const value = text.replace(/[^0-9]/g, '');
    if (isHours) {
      if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 23)) {
        setHours(value);
      }
    } else {
      if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59)) {
        setMinutes(value);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {initialEntry ? translations.editEntry : translations.addEntry}
          </Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{translations.foodName}</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError('');
              }}
              placeholder={translations.enterFoodName}
              autoFocus
              textAlign="right"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <View style={styles.timeSection}>
            <TouchableOpacity
              style={styles.timeToggle}
              onPress={() => setUseCustomTime(!useCustomTime)}>
              <Text style={[
                styles.timeToggleText,
                useCustomTime && styles.timeToggleTextActive
              ]}>
                {translations.customTime}
              </Text>
              <Clock size={20} color={useCustomTime ? '#2196F3' : '#757575'} />
            </TouchableOpacity>

            {useCustomTime && (
              <View style={styles.timeInputContainer}>
                <View style={styles.timeInputWrapper}>
                <TextInput
                    style={styles.timeInput}
                    value={hours}
                    onChangeText={(text) => handleTimeChange(text, true)}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="HH"
                  />
                  <Text style={styles.timeSeparator}>:</Text>
                  
                  <TextInput
                    style={styles.timeInput}
                    value={minutes}
                    onChangeText={(text) => handleTimeChange(text, false)}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="MM"
                  />
                </View>
              </View>
            )}
          </View>

          <View style={styles.buttonContainer}>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.button,
                styles.saveButton,
                pressed && styles.buttonPressed,
              ]}>
              <Text style={[styles.buttonText, styles.saveButtonText]}>
                {translations.save}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.buttonPressed,
              ]}>
              <Text style={styles.buttonText}>{translations.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 24,
    color: '#000000',
    textAlign: 'right',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: '#757575',
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
    textAlign: 'right',
  },
  inputError: {
    borderColor: '#FF5252',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  timeSection: {
    marginBottom: 24,
  },
  timeToggle: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  timeToggleText: {
    marginRight: 8,
    fontSize: 16,
    color: '#757575',
  },
  timeToggleTextActive: {
    color: '#2196F3',
  },
  timeInputContainer: {
    marginTop: 12,
  },
  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  timeInput: {
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
    width: 50,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '500',
    marginHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    gap: 8,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginLeft: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#FFFFFF',
  },
});