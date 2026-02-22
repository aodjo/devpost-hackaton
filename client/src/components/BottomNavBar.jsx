import { Animated, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

function BottomNavBar({
  styles,
  navItemKeys,
  activeTab,
  onPressNavItem,
  bottomNavBottom,
  onLayout,
  navIndicatorWidth,
  navIndicatorAnim,
}) {
  const { t } = useTranslation()

  return (
    <View style={[styles.bottomNav, { bottom: bottomNavBottom }]} onLayout={onLayout}>
      {navIndicatorWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.navIndicator,
            {
              width: navIndicatorWidth,
              transform: [{ translateX: navIndicatorAnim }],
            },
          ]}
        />
      ) : null}

      {navItemKeys.map((key) => (
        <Pressable key={key} style={styles.navItem} onPress={() => onPressNavItem(key)}>
          <Text style={[styles.navText, activeTab === key && styles.navTextActive]}>
            {t(`nav.${key}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

export default BottomNavBar
