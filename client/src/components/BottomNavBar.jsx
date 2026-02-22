import { Animated, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useTranslation } from 'react-i18next'

function BottomNavBar({
  styles,
  activeTab,
  onPressNavItem,
  bottomNavBottom,
  onLayout,
  navIndicatorWidth,
  leftIndicatorAnim,
  rightIndicatorAnim,
}) {
  const { t } = useTranslation()

  const leftItems = ['home', 'navigation']
  const rightItems = ['transit', 'profile']
  const isLeftActive = leftItems.includes(activeTab)
  const isRightActive = rightItems.includes(activeTab)

  return (
    <View style={[styles.bottomNav, { bottom: bottomNavBottom }]} onLayout={onLayout}>
      {/* Left group: 홈, 내비게이션 */}
      <View style={styles.navGroup}>
        {navIndicatorWidth > 0 && isLeftActive ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.navIndicator,
              {
                width: navIndicatorWidth,
                transform: [{ translateX: leftIndicatorAnim }],
              },
            ]}
          />
        ) : null}
        {leftItems.map((key) => (
          <Pressable key={key} style={styles.navItem} onPress={() => onPressNavItem(key)}>
            <Text style={[styles.navText, activeTab === key && styles.navTextActive]}>
              {t(`nav.${key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Center: 카메라 버튼 */}
      <Pressable style={styles.navCameraButton} onPress={() => onPressNavItem('camera')}>
        <Feather name="camera" size={24} color="#f8fafc" />
      </Pressable>

      {/* Right group: 대중교통, 내 정보 */}
      <View style={styles.navGroup}>
        {navIndicatorWidth > 0 && isRightActive ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.navIndicator,
              {
                width: navIndicatorWidth,
                transform: [{ translateX: rightIndicatorAnim }],
              },
            ]}
          />
        ) : null}
        {rightItems.map((key) => (
          <Pressable key={key} style={styles.navItem} onPress={() => onPressNavItem(key)}>
            <Text style={[styles.navText, activeTab === key && styles.navTextActive]}>
              {t(`nav.${key}`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

export default BottomNavBar
