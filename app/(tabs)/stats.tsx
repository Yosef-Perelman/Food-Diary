import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, TrendingDown, Minus, Search, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subDays, startOfMonth, endOfMonth, addDays, eachDayOfInterval, parseISO, subMonths, addMonths } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';

interface DayData {
  moodRating: number;
  foodEntries: Array<{
    id: string;
    name: string;
    time: number;
  }>;
}

interface FoodMoodData {
  [foodName: string]: {
    totalScore: number;
    occurrences: number;
    averageScore: number;
  };
}

interface DailyMoodData {
  date: string;
  score: number;
}

// Hebrew translations
const translations = {
  statistics: 'סטטיסטיקה',
  monthlyMood: 'ממוצע תחושה חודשית',
  average: 'ממוצע',
  trending: {
    up: 'במגמת עלייה',
    down: 'במגמת ירידה',
    same: 'ללא שינוי',
    null: 'ללא נתונים',
  },
  comparedTo: 'בהשוואה לחודש הקודם',
  foodMoodCorrelation: 'השפעות מזון על מצב הרוח',
  search: 'חיפוש מאכלים...',
  sortBy: {
    name: 'לפי שם',
    score: 'לפי ציון',
  },
  occurrences: 'פעמים',
  noData: 'אין נתונים להצגה',
};

export default function Stats() {
  const [loading, setLoading] = useState(true);
  const [currentAverage, setCurrentAverage] = useState<number | null>(null);
  const [previousAverage, setPreviousAverage] = useState<number | null>(null);
  const [trend, setTrend] = useState<'up' | 'down' | 'same' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [foodMoodData, setFoodMoodData] = useState<FoodMoodData>({});
  const [sortBy, setSortBy] = useState<'name' | 'score'>('score');
  const [dailyMoodData, setDailyMoodData] = useState<DailyMoodData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [chartLoading, setChartLoading] = useState(false);
  
  const screenWidth = Dimensions.get('window').width - 32;

  const calculateMoodAverages = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date();
      const currentMonthStart = startOfMonth(today);
      const currentMonthEnd = endOfMonth(today);
      const previousMonthStart = startOfMonth(subDays(currentMonthStart, 1));
      const previousMonthEnd = endOfMonth(subDays(currentMonthStart, 1));

      // Get current month data
      const currentMonthMoods: number[] = [];
      let currentDate = currentMonthStart;
      
      // For chart data - initially load current month
      await loadChartDataForMonth(selectedMonth);
      
      while (currentDate <= currentMonthEnd && currentDate <= today) {
        const key = `dayData_${format(currentDate, 'yyyy-MM-dd')}`;
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const dayData: DayData = JSON.parse(data);
          if (dayData.moodRating) {
            currentMonthMoods.push(dayData.moodRating);
          }
        }
        currentDate = addDays(currentDate, 1);
      }

      // Get previous month data
      const previousMonthMoods: number[] = [];
      currentDate = previousMonthStart;
      while (currentDate <= previousMonthEnd) {
        const key = `dayData_${format(currentDate, 'yyyy-MM-dd')}`;
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const dayData: DayData = JSON.parse(data);
          if (dayData.moodRating) {
            previousMonthMoods.push(dayData.moodRating);
          }
        }
        currentDate = addDays(currentDate, 1);
      }

      // Calculate averages
      const currentAvg = currentMonthMoods.length > 0
        ? currentMonthMoods.reduce((a, b) => a + b, 0) / currentMonthMoods.length
        : null;
      const previousAvg = previousMonthMoods.length > 0
        ? previousMonthMoods.reduce((a, b) => a + b, 0) / previousMonthMoods.length
        : null;

      setCurrentAverage(currentAvg);
      setPreviousAverage(previousAvg);

      // Determine trend
      if (currentAvg !== null && previousAvg !== null) {
        if (currentAvg > previousAvg) {
          setTrend('up');
        } else if (currentAvg < previousAvg) {
          setTrend('down');
        } else {
          setTrend('same');
        }
      }

      // Calculate food-mood correlations
      const foodMoodMap: FoodMoodData = {};
      
      // Analyze all dates
      const allDates = await AsyncStorage.getAllKeys();
      const dayDataKeys = allDates.filter(key => key.startsWith('dayData_'));
      
      for (const key of dayDataKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const dayData: DayData = JSON.parse(data);
          if (dayData.moodRating && dayData.foodEntries) {
            // Process each food entry
            dayData.foodEntries.forEach(entry => {
              const foodName = entry.name.toLowerCase();
              if (!foodMoodMap[foodName]) {
                foodMoodMap[foodName] = {
                  totalScore: 0,
                  occurrences: 0,
                  averageScore: 0,
                };
              }
              foodMoodMap[foodName].totalScore += dayData.moodRating;
              foodMoodMap[foodName].occurrences += 1;
              foodMoodMap[foodName].averageScore = 
                foodMoodMap[foodName].totalScore / foodMoodMap[foodName].occurrences;
            });
          }
        }
      }

      setFoodMoodData(foodMoodMap);
    } catch (error) {
      console.error('Error calculating mood averages:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  const loadChartDataForMonth = useCallback(async (date: Date) => {
    try {
      setChartLoading(true);
      
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      // Get all days in the selected month
      const daysInMonth = eachDayOfInterval({
        start: monthStart,
        end: monthEnd
      });
      
      const dailyMoods: DailyMoodData[] = [];
      
      for (const day of daysInMonth) {
        const key = `dayData_${format(day, 'yyyy-MM-dd')}`;
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const dayData: DayData = JSON.parse(data);
          if (dayData.moodRating) {
            dailyMoods.push({
              date: format(day, 'dd'),
              score: dayData.moodRating
            });
          } else {
            // If no mood rating for this day, use null to create a gap in the chart
            dailyMoods.push({
              date: format(day, 'dd'),
              score: 0
            });
          }
        } else {
          dailyMoods.push({
            date: format(day, 'dd'),
            score: 0
          });
        }
      }
      
      setDailyMoodData(dailyMoods);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setChartLoading(false);
    }
  }, []);

  const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
    setSelectedMonth(currentMonth => {
      const newMonth = direction === 'prev' 
        ? subMonths(currentMonth, 1) 
        : addMonths(currentMonth, 1);
      
      // Don't allow navigating to future months
      if (direction === 'next' && newMonth > new Date()) {
        return currentMonth;
      }
      
      // Load data for the new month
      loadChartDataForMonth(newMonth);
      return newMonth;
    });
  }, [loadChartDataForMonth]);

  useFocusEffect(
    useCallback(() => {
      calculateMoodAverages();
    }, [calculateMoodAverages])
  );

  const renderTrendIcon = () => {
    if (!trend) return null;

    const iconProps = {
      size: 24,
      color: trend === 'up' ? '#34C759' : trend === 'down' ? '#FF3B30' : '#8E8E93',
    };

    switch (trend) {
      case 'up':
        return <TrendingUp {...iconProps} />;
      case 'down':
        return <TrendingDown {...iconProps} />;
      case 'same':
        return <Minus {...iconProps} />;
      default:
        return null;
    }
  };

  const filteredFoodData = Object.entries(foodMoodData)
    .filter(([name]) => name.includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a[0].localeCompare(b[0]);
      }
      return b[1].averageScore - a[1].averageScore;
    });
    
  // Filter out days with 0 score (no data) for the chart
  const chartData = {
    labels: dailyMoodData.filter(day => day.score > 0).map(day => day.date),
    datasets: [
      {
        data: dailyMoodData.filter(day => day.score > 0).map(day => day.score),
        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
        strokeWidth: 2
      }
    ]
  };

  // Find min and max values for the chart
  const moodScores = dailyMoodData.filter(day => day.score > 0).map(day => day.score);
  const minScore = moodScores.length > 0 ? Math.min(...moodScores) : 1;
  const maxScore = moodScores.length > 0 ? Math.max(...moodScores) : 10;
  
  // Calculate a good min value for the y-axis (slightly lower than the minimum score)
  const yAxisMin = Math.max(1, Math.floor(minScore - 1));
  
  const chartConfig = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#007AFF'
    },
    propsForBackgroundLines: {
      strokeDasharray: ''
    },
    // Set minimum value for y-axis to avoid showing 0
    min: yAxisMin,
    // Set maximum value for y-axis with some padding
    max: Math.min(10, Math.ceil(maxScore + 1))
  };

  // Check if selected month is current month
  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{translations.statistics}</Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{translations.monthlyMood}</Text>
          
          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : (
            <>
              <View style={styles.moodScore}>
                <Text style={styles.scoreNumber}>
                  {currentAverage !== null ? currentAverage.toFixed(1) : '-'}
                </Text>
              </View>

              <View style={styles.trendContainer}>
                {renderTrendIcon()}
                <Text style={styles.trendText}>
                  {translations.trending[trend]}
                </Text>
              </View>

              <Text style={styles.comparisonText}>
                {previousAverage !== null
                  ? `{translations.comparedTo} {previousAverage.toFixed(1)}`
                  : 'No data from previous month'}
              </Text>
            </>
          )}
        </View>
        
        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <Text style={styles.cardTitle}>מגמות בתחושה</Text>
            <View style={styles.monthSelector}>
            <Pressable
                onPress={() => handleMonthChange('next')}
                disabled={isCurrentMonth}
                style={({ pressed }) => [
                  styles.monthButton,
                  isCurrentMonth && styles.monthButtonDisabled,
                  pressed && styles.buttonPressed,
                ]}>
                <ChevronRight size={20} color={isCurrentMonth ? '#CCCCCC' : '#007AFF'} />
              </Pressable>
              <Text style={styles.monthText}>
                {format(selectedMonth, 'MMMM yyyy')}
              </Text>
              
              <Pressable
                onPress={() => handleMonthChange('prev')}
                style={({ pressed }) => [
                  styles.monthButton,
                  pressed && styles.buttonPressed,
                ]}>
                <ChevronLeft size={20} color="#007AFF" />
              </Pressable>
            </View>
          </View>
          
          {loading || chartLoading ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : dailyMoodData.filter(day => day.score > 0).length > 0 ? (
            <View style={styles.chartContainer}>
              <LineChart
                data={chartData}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                fromZero={false}
                yAxisSuffix=""
                yAxisInterval={1}
                segments={4}
                withVerticalLines={false}
                withHorizontalLines={true}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                withInnerLines={false}
                yLabelsOffset={10}
              />
              <Text style={styles.chartLabel}>Days of the Month</Text>
            </View>
          ) : (
            <Text style={styles.noDataText}>
              {translations.noData} {format(selectedMonth, 'MMMM yyyy')}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{translations.foodMoodCorrelation}</Text>
          
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Search size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={translations.search}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery !== '' && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  style={({ pressed }) => [
                    styles.clearButton,
                    pressed && styles.buttonPressed,
                  ]}>
                  <X size={16} color="#666" />
                </Pressable>
              )}
            </View>
            <View style={styles.sortButtons}>
              <Pressable
                onPress={() => setSortBy('score')}
                style={[
                  styles.sortButton,
                  sortBy === 'score' && styles.sortButtonActive,
                ]}>
                <Text
                  style={[
                    styles.sortButtonText,
                    sortBy === 'score' && styles.sortButtonTextActive,
                  ]}>
                  {translations.sortBy.score}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSortBy('name')}
                style={[
                  styles.sortButton,
                  sortBy === 'name' && styles.sortButtonActive,
                ]}>
                <Text
                  style={[
                    styles.sortButtonText,
                    sortBy === 'name' && styles.sortButtonTextActive,
                  ]}>
                  {translations.sortBy.name}
                </Text>
              </Pressable>
            </View>
          </View>

          {filteredFoodData.length > 0 ? (
            <View style={styles.foodList}>
              {filteredFoodData.map(([name, data]) => (
                <View key={name} style={styles.foodItem}>
                  <View style={styles.foodInfo}>
                    <Text style={styles.foodName}>
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.scoreContainer}>
                    <Text
                      style={[
                        styles.foodScore,
                        data.averageScore >= 7
                          ? styles.scoreHigh
                          : data.averageScore >= 5
                          ? styles.scoreMedium
                          : styles.scoreLow,
                      ]}>
                      {data.averageScore.toFixed(1)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noDataText}>
              {searchQuery
                ? 'No foods found matching your search'
                : 'No food entries recorded yet'}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    textAlign: 'right',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
    textAlign: 'right',
  },
  chartHeader: {
    flexDirection: 'column',
    marginBottom: 20,
  },
  monthSelector: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthButtonDisabled: {
    backgroundColor: '#F5F5F5',
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginHorizontal: 12,
    minWidth: 120,
    textAlign: 'center',
  },
  moodScore: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 15,
    color: '#666',
  },
  trendContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  trendText: {
    fontSize: 15,
    fontWeight: '500',
    marginRight: 8,
  },
  comparisonText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    padding: 4,
    textAlign: 'right',
  },
  clearButton: {
    padding: 4,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  sortButtons: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  sortButtonTextActive: {
    color: '#FFF',
  },
  foodList: {
    gap: 12,
  },
  foodItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
  },
  foodInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  foodName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    textAlign: 'right',
  },
  foodOccurrences: {
    fontSize: 13,
    color: '#666',
    textAlign: 'right',
  },
  scoreContainer: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  foodScore: {
    fontSize: 16,
    fontWeight: '600',
  },
  scoreHigh: {
    color: '#34C759',
  },
  scoreMedium: {
    color: '#FF9500',
  },
  scoreLow: {
    color: '#FF3B30',
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 15,
    marginTop: 20,
  },
});