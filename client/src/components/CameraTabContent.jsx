import { useRef, useState } from 'react'
import {
  Pressable,
  Text,
  View,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useTranslation } from 'react-i18next'
import Feather from '@expo/vector-icons/Feather'
import Constants from 'expo-constants'

const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://10.0.2.2:8000'

const OBSTACLE_TYPES = ['Stuff', 'Stair', 'EV']

function CameraTabContent({ styles, onClose, currentLocation, userData }) {
  const { t } = useTranslation()
  const cameraRef = useRef(null)
  const [facing, setFacing] = useState('back')
  const [photo, setPhoto] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()

  // 폼 상태
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [obstacleType, setObstacleType] = useState('Stuff')

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'))
  }

  const takePhoto = async () => {
    if (!cameraRef.current) return

    const photoData = await cameraRef.current.takePictureAsync({
      quality: 0.8,
      base64: false,
    })
    setPhoto(photoData)
  }

  const retakePhoto = () => {
    setPhoto(null)
    setShowForm(false)
    setName('')
    setDescription('')
    setObstacleType('Stuff')
  }

  const proceedToForm = () => {
    setShowForm(true)
  }

  const submitReport = async () => {
    if (!name.trim()) {
      Alert.alert(t('report.error'), t('report.nameRequired'))
      return
    }

    if (!currentLocation) {
      Alert.alert(t('report.error'), t('report.locationRequired'))
      return
    }

    setIsSubmitting(true)

    try {
      // 1. 장애물 제보 등록
      const addPlaceResponse = await fetch(`${API_BASE_URL}/warning/add_place`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userData?.id || 1,
          name: name.trim(),
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          description: description.trim(),
          type: obstacleType,
        }),
      })

      const addPlaceData = await addPlaceResponse.json()

      if (!addPlaceResponse.ok) {
        throw new Error(addPlaceData.detail || 'Failed to add place')
      }

      const placeId = addPlaceData.id

      // 2. 이미지 업로드
      if (photo && placeId) {
        const formData = new FormData()
        formData.append('image', {
          uri: photo.uri,
          type: 'image/png',
          name: 'photo.png',
        })

        const uploadResponse = await fetch(
          `${API_BASE_URL}/warning/update_place_img/${placeId}`,
          {
            method: 'POST',
            body: formData,
          }
        )

        if (!uploadResponse.ok) {
          console.warn('Image upload failed, but place was created')
        }
      }

      Alert.alert(t('report.success'), t('report.submitSuccess'), [
        { text: t('profile.confirm'), onPress: onClose },
      ])
    } catch (error) {
      console.error('Submit error:', error)
      Alert.alert(t('report.error'), t('report.submitFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // 권한이 아직 확인되지 않은 경우
  if (!permission) {
    return (
      <View style={styles.cameraContainer}>
        <View style={styles.cameraPermissionContainer}>
          <Feather name="camera-off" size={48} color="#64748b" />
          <Text style={styles.cameraPermissionText}>
            {t('camera.permissionRequired')}
          </Text>
        </View>
      </View>
    )
  }

  // 권한이 거부된 경우
  if (!permission.granted) {
    return (
      <View style={styles.cameraContainer}>
        <View style={styles.cameraPermissionContainer}>
          <Feather name="camera-off" size={48} color="#64748b" />
          <Text style={styles.cameraPermissionTitle}>
            {t('camera.permissionRequired')}
          </Text>
          <Text style={styles.cameraPermissionText}>
            {t('camera.permissionMessage')}
          </Text>
          <Pressable style={styles.cameraPermissionButton} onPress={requestPermission}>
            <Text style={styles.cameraPermissionButtonText}>
              {t('camera.grantPermission')}
            </Text>
          </Pressable>
        </View>
      </View>
    )
  }

  // 제보 폼 화면
  if (photo && showForm) {
    return (
      <KeyboardAvoidingView
        style={styles.cameraContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.reportFormContainer} contentContainerStyle={styles.reportFormContent}>
          {/* 사진 미리보기 (작게) */}
          <View style={styles.reportPhotoPreview}>
            <Image source={{ uri: photo.uri }} style={styles.reportPhotoImage} />
            <Pressable style={styles.reportPhotoRetake} onPress={retakePhoto}>
              <Feather name="refresh-cw" size={16} color="#f8fafc" />
            </Pressable>
          </View>

          {/* 제보 이름 */}
          <View style={styles.reportInputGroup}>
            <Text style={styles.reportInputLabel}>{t('report.name')}</Text>
            <TextInput
              style={styles.reportInput}
              placeholder={t('report.namePlaceholder')}
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              maxLength={50}
            />
          </View>

          {/* 장애물 타입 */}
          <View style={styles.reportInputGroup}>
            <Text style={styles.reportInputLabel}>{t('report.type')}</Text>
            <View style={styles.reportTypeButtons}>
              {OBSTACLE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.reportTypeButton,
                    obstacleType === type && styles.reportTypeButtonActive,
                  ]}
                  onPress={() => setObstacleType(type)}
                >
                  <Text
                    style={[
                      styles.reportTypeButtonText,
                      obstacleType === type && styles.reportTypeButtonTextActive,
                    ]}
                  >
                    {t(`report.types.${type}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 상세 설명 */}
          <View style={styles.reportInputGroup}>
            <Text style={styles.reportInputLabel}>{t('report.description')}</Text>
            <TextInput
              style={[styles.reportInput, styles.reportInputMultiline]}
              placeholder={t('report.descriptionPlaceholder')}
              placeholderTextColor="#94a3b8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>

          {/* 위치 정보 */}
          <View style={styles.reportLocationInfo}>
            <Feather name="map-pin" size={16} color="#64748b" />
            <Text style={styles.reportLocationText}>
              {currentLocation
                ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
                : t('report.locationUnavailable')}
            </Text>
          </View>

          {/* 제출 버튼 */}
          <View style={styles.reportActions}>
            <Pressable
              style={styles.reportCancelButton}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.reportCancelButtonText}>{t('profile.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.reportSubmitButton, isSubmitting && styles.reportSubmitButtonDisabled]}
              onPress={submitReport}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#f8fafc" />
              ) : (
                <>
                  <Feather name="send" size={18} color="#f8fafc" />
                  <Text style={styles.reportSubmitButtonText}>{t('report.submit')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // 사진이 찍힌 경우 미리보기 표시
  if (photo) {
    return (
      <View style={styles.cameraContainer}>
        <Image source={{ uri: photo.uri }} style={styles.cameraPreview} />
        <View style={styles.cameraPreviewActions}>
          <Pressable style={styles.cameraActionButton} onPress={retakePhoto}>
            <Feather name="refresh-cw" size={24} color="#0f172a" />
            <Text style={styles.cameraActionButtonText}>{t('camera.retake')}</Text>
          </Pressable>
          <Pressable
            style={[styles.cameraActionButton, styles.cameraActionButtonPrimary]}
            onPress={proceedToForm}
          >
            <Feather name="arrow-right" size={24} color="#f8fafc" />
            <Text style={[styles.cameraActionButtonText, styles.cameraActionButtonTextPrimary]}>
              {t('camera.next')}
            </Text>
          </Pressable>
        </View>
      </View>
    )
  }

  // 카메라 뷰
  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
      <View style={styles.cameraOverlayAbsolute}>
        {/* 상단 컨트롤 */}
        <View style={styles.cameraTopControls}>
          <Pressable style={styles.cameraControlButton} onPress={onClose}>
            <Feather name="x" size={24} color="#f8fafc" />
          </Pressable>
          <Pressable style={styles.cameraControlButton} onPress={toggleCameraFacing}>
            <Feather name="refresh-cw" size={24} color="#f8fafc" />
          </Pressable>
        </View>

        {/* 하단 셔터 버튼 */}
        <View style={styles.cameraBottomControls}>
          <Pressable style={styles.cameraShutterButton} onPress={takePhoto}>
            <View style={styles.cameraShutterButtonInner} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export default CameraTabContent
