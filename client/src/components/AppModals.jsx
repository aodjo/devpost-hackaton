import { Image, Modal, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

function AppModals({
  styles,
  badgeModalVisible,
  selectedBadge,
  onCloseBadgeModal,
}) {
  const { t } = useTranslation()

  return (
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
  )
}

export default AppModals
