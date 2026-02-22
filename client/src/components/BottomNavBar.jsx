import { Animated, Pressable, Text, View } from 'react-native'

function BottomNavBar({
  styles,
  navItems,
  activeTab,
  onPressNavItem,
  bottomNavBottom,
  onLayout,
  navIndicatorWidth,
  navIndicatorAnim,
}) {
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

      {navItems.map((item) => (
        <Pressable key={item} style={styles.navItem} onPress={() => onPressNavItem(item)}>
          <Text style={[styles.navText, activeTab === item && styles.navTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export default BottomNavBar
