import { useRef, useState } from 'react'
import { Pressable, Text, View, Image } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useTranslation } from 'react-i18next'
import Feather from '@expo/vector-icons/Feather'

function CameraTabContent({ styles, onClose }) {
  const { t } = useTranslation()
  const cameraRef = useRef(null)
  const [facing, setFacing] = useState('back')
  const [photo, setPhoto] = useState(null)
  const [permission, requestPermission] = useCameraPermissions()

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
  }

  const usePhoto = () => {
    // TODO: 사진 사용 로직 (업로드, 저장 등)
    console.log('Photo URI:', photo.uri)
    setPhoto(null)
    if (onClose) onClose()
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
          <Pressable style={[styles.cameraActionButton, styles.cameraActionButtonPrimary]} onPress={usePhoto}>
            <Feather name="check" size={24} color="#f8fafc" />
            <Text style={[styles.cameraActionButtonText, styles.cameraActionButtonTextPrimary]}>
              {t('camera.usePhoto')}
            </Text>
          </Pressable>
        </View>
      </View>
    )
  }

  // 카메라 뷰
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        <View style={styles.cameraOverlay}>
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
      </CameraView>
    </View>
  )
}

export default CameraTabContent
