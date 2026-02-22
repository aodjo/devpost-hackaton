import { Image, Modal, Pressable, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'

function AppModals({
  styles,
  loginModalVisible,
  changePasswordModalVisible,
  badgeModalVisible,
  username,
  setUsername,
  password,
  setPassword,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  selectedBadge,
  onCancelLogin,
  onSubmitLogin,
  onCancelChangePassword,
  onSubmitChangePassword,
  onCloseBadgeModal,
}) {
  const { t } = useTranslation()

  return (
    <>
      <Modal
        animationType="fade"
        transparent={true}
        visible={loginModalVisible}
        onRequestClose={onCancelLogin}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t('profile.login')}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder={t('profile.username')}
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={setUsername}
            />

            <TextInput
              style={styles.modalInput}
              placeholder={t('profile.password')}
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
            />

            <View style={styles.modalButtonRow}>
              <Pressable style={[styles.modalButton, styles.modalButtonCancel]} onPress={onCancelLogin}>
                <Text style={styles.modalButtonCancelText}>{t('profile.cancel')}</Text>
              </Pressable>

              <Pressable style={[styles.modalButton, styles.modalButtonSubmit]} onPress={onSubmitLogin}>
                <Text style={styles.modalButtonSubmitText}>{t('profile.login')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={changePasswordModalVisible}
        onRequestClose={onCancelChangePassword}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t('profile.changePassword')}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder={t('profile.currentPassword')}
              placeholderTextColor="#94a3b8"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={true}
            />

            <TextInput
              style={styles.modalInput}
              placeholder={t('profile.newPassword')}
              placeholderTextColor="#94a3b8"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={true}
            />

            <TextInput
              style={styles.modalInput}
              placeholder={t('profile.confirmPassword')}
              placeholderTextColor="#94a3b8"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={true}
            />

            <View style={styles.modalButtonRow}>
              <Pressable style={[styles.modalButton, styles.modalButtonCancel]} onPress={onCancelChangePassword}>
                <Text style={styles.modalButtonCancelText}>{t('profile.cancel')}</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={onSubmitChangePassword}
              >
                <Text style={styles.modalButtonSubmitText}>{t('profile.change')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={badgeModalVisible}
        onRequestClose={onCloseBadgeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.badgeModalContainer}>
            {selectedBadge ? (
              <>
                <View style={styles.badgeModalIcon}>
                  <Image source={selectedBadge.image} style={styles.badgeModalImage} />
                </View>
                <Text style={styles.badgeModalTitle}>{selectedBadge.name}</Text>
                <Text style={styles.badgeModalDescription}>{selectedBadge.description}</Text>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonSubmit, styles.badgeModalCloseButton]}
                  onPress={onCloseBadgeModal}
                >
                  <Text style={styles.modalButtonSubmitText}>{t('profile.close')}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  )
}

export default AppModals
