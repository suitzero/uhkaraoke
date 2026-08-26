import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import YoutubePlayer from 'react-native-youtube-iframe';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

export default function App() {
  const [playing, setPlaying] = useState(false);
  const [facing, setFacing] = useState('front');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [isRecording, setIsRecording] = useState(false);
  const [echoEnabled, setEchoEnabled] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [finalVideoPath, setFinalVideoPath] = useState(null);

  const cameraRef = useRef(null);
  const youtubeRef = useRef(null);

  if (!cameraPermission || !micPermission) {
    return <View />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', color: 'white', marginBottom: 10 }}>We need your permission to use the camera and microphone for recording karaoke videos.</Text>
        <TouchableOpacity style={styles.button} onPress={() => { requestCameraPermission(); requestMicPermission(); }}>
          <Text style={styles.text}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  async function startRecording() {
    if (cameraRef.current) {
      setIsRecording(true);
      // Ensure Youtube is playing
      setPlaying(true);
      if (youtubeRef.current) {
        youtubeRef.current.seekTo(0);
      }
      try {
        const video = await cameraRef.current.recordAsync();
        console.log("Raw Video saved to", video.uri);
        processVideo(video.uri);
      } catch (e) {
        console.error(e);
      }
      setIsRecording(false);
      setPlaying(false);
    }
  }

  function stopRecording() {
    if (cameraRef.current) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
      setPlaying(false);
    }
  }

  const processVideo = async (videoUri) => {
    setProcessing(true);

    // In a real Expo project, `ffmpeg-kit-react-native` requires a prebuild (eas build).
    // The following code demonstrates how FFmpeg mixing and echo effect would be applied.
    try {
      const FFmpegKit = require('ffmpeg-kit-react-native').FFmpegKit;

      const outputPath = videoUri.replace('.mp4', '_processed.mp4');

      // Note: Because it's a Youtube Iframe, we can't extract the audio directly.
      // We would have to use a backend to download the youtube audio or rely on the device's
      // internal audio loopback if the OS permits it.
      //
      // For this implementation, we simulate the mixing by applying the echo filter
      // to the recorded camera video (which includes the microphone audio).
      // If we had a direct youtube MP4 or MP3, we would mix it using the `-filter_complex amix` filter.

      let ffmpegCommand = `-i ${videoUri}`;

      if (echoEnabled) {
        // Apply echo filter (delay, decay)
        ffmpegCommand += ` -af "aecho=0.8:0.9:1000:0.3"`;
      }

      ffmpegCommand += ` -c:v copy -y ${outputPath}`;

      console.log('Running FFmpeg command:', ffmpegCommand);

      const session = await FFmpegKit.execute(ffmpegCommand);
      const returnCode = await session.getReturnCode();

      if (returnCode.isValueSuccess()) {
        console.log('Video processed successfully at:', outputPath);
        setFinalVideoPath(outputPath);
      } else {
        console.log('Video processing failed.');
      }
    } catch (error) {
      console.log('FFmpeg processing error (likely missing native modules in Expo Go):', error.message);
      setFinalVideoPath(videoUri); // fallback
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Half: YouTube Karaoke */}
        <View style={styles.topHalf}>
          {Platform.OS === 'web' ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: 'white' }}>YouTube player on web requires native mobile.</Text>
            </View>
          ) : (
            <YoutubePlayer
              ref={youtubeRef}
              height={300}
              play={playing}
              videoId={"6W5pq4bIzI8"} // Example karaoke video
            />
          )}
        </View>

        {/* Bottom Half: Camera & Controls */}
        <View style={styles.bottomHalf}>
          <CameraView
            style={styles.camera}
            facing={facing}
            ref={cameraRef}
            mode="video"
          />
          <View style={styles.controlsContainer}>
            <View style={styles.topControls}>
              <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing}>
                <Text style={styles.iconText}>Flip 🔄</Text>
              </TouchableOpacity>
              <View style={styles.audioSettings}>
                <Text style={styles.audioSettingsText}>Mic: On</Text>
                <TouchableOpacity style={[styles.iconButton, echoEnabled && styles.activeButton]} onPress={() => setEchoEnabled(!echoEnabled)}>
                  <Text style={styles.iconText}>Echo {echoEnabled ? 'On' : 'Off'} 🎤</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.bottomControls}>
              {processing ? (
                <Text style={{ color: 'white' }}>Processing Video...</Text>
              ) : (
                <TouchableOpacity
                  style={[styles.recordButton, isRecording && styles.recordingButton]}
                  onPress={isRecording ? stopRecording : startRecording}
                >
                  <View style={styles.recordButtonInner} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <StatusBar style="light" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'black',
  },
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: 'black',
    justifyContent: 'center',
  },
  topHalf: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  bottomHalf: {
    flex: 1,
    backgroundColor: '#111',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 20,
    zIndex: 10,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  audioSettings: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  audioSettingsText: {
    color: 'white',
    marginBottom: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: 20,
  },
  iconButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
  },
  activeButton: {
    backgroundColor: 'rgba(0, 150, 136, 0.8)',
  },
  iconText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  recordingButton: {
    borderColor: 'red',
  },
  recordButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'red',
  },
  button: {
    backgroundColor: '#1E90FF',
    padding: 15,
    margin: 20,
    borderRadius: 10,
  },
  text: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  }
});
