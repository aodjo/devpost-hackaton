import { Image, Pressable, Text, View } from 'react-native'

function ProfileTabContent({
  styles,
  loggedIn,
  username,
  badges,
  onOpenLogin,
  onOpenChangePassword,
  onLogout,
  onSelectBadge,
}) {
  return (
    <View style={styles.profileContainer}>
      <View style={styles.profileScrollContent}>
        {!loggedIn ? (
          <View style={styles.profileCard}>
            <Text style={styles.profileText}>로그인해서 배지 얻기</Text>
            <Pressable style={styles.loginButton} onPress={onOpenLogin}>
              <Text style={styles.loginButtonText}>로그인</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <Text style={styles.profileText}>내 정보</Text>
              <Text style={styles.profileValue}>{username}</Text>
              <View style={styles.profileActions}>
                <Pressable style={styles.changePasswordButton} onPress={onOpenChangePassword}>
                  <Text style={styles.changePasswordButtonText}>비밀번호 변경</Text>
                </Pressable>
                <Pressable style={styles.logoutButton} onPress={onLogout}>
                  <Text style={styles.logoutButtonText}>로그아웃</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.badgesSection}>
              <Text style={styles.badgesTitle}>내 배지</Text>
              <View style={styles.badgesGrid}>
                {badges.map((badge) => (
                  <Pressable key={badge.id} style={styles.badgeItem} onPress={() => onSelectBadge(badge)}>
                    <View style={styles.badgeIcon}>
                      <Image source={badge.image} style={styles.badgeImage} />
                    </View>
                    <View style={styles.badgeContent}>
                      <Text style={styles.badgeName}>{badge.name}</Text>
                      <Text style={styles.badgeDescription}>{badge.description}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

export default ProfileTabContent
