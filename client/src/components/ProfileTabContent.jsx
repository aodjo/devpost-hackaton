import { Image, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '../i18n'

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
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language

  const handleLanguageChange = async (lang) => {
    await changeLanguage(lang)
  }

  return (
    <View style={styles.profileContainer}>
      <View style={styles.profileScrollContent}>
        {!loggedIn ? (
          <View style={styles.profileCard}>
            <Text style={styles.profileText}>{t('profile.loginPrompt')}</Text>
            <Pressable style={styles.loginButton} onPress={onOpenLogin}>
              <Text style={styles.loginButtonText}>{t('profile.login')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <Text style={styles.profileText}>{t('profile.myProfile')}</Text>
              <Text style={styles.profileValue}>{username}</Text>
              <View style={styles.profileActions}>
                <Pressable style={styles.changePasswordButton} onPress={onOpenChangePassword}>
                  <Text style={styles.changePasswordButtonText}>{t('profile.changePassword')}</Text>
                </Pressable>
                <Pressable style={styles.logoutButton} onPress={onLogout}>
                  <Text style={styles.logoutButtonText}>{t('profile.logout')}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.badgesSection}>
              <Text style={styles.badgesTitle}>{t('profile.myBadges')}</Text>
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

        <View style={styles.languageSection}>
          <Text style={styles.languageTitle}>{t('profile.language')}</Text>
          <View style={styles.languageButtons}>
            <Pressable
              style={[styles.languageButton, currentLang === 'ko' && styles.languageButtonActive]}
              onPress={() => handleLanguageChange('ko')}
            >
              <Text style={[styles.languageButtonText, currentLang === 'ko' && styles.languageButtonTextActive]}>
                {t('language.korean')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.languageButton, currentLang === 'en' && styles.languageButtonActive]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text style={[styles.languageButtonText, currentLang === 'en' && styles.languageButtonTextActive]}>
                {t('language.english')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}

export default ProfileTabContent
