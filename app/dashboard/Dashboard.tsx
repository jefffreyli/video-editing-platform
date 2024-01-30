"use client";

import { useState, useEffect, useRef } from "react";
import { auth } from "@/firebase/config";
import { useRouter } from "next/navigation";
import Timeline from "./timeline/Timeline";

import MediaLibrary from "./media/MediaLibrary";
import VideoDisplay from "./media/VideoDisplay";
import AudioDisplay from "./media/AudioDisplay";

import { MediaFile, MediaList, MediaType } from "./types";
import { fetchMedia, uploadToFirebase } from "./lib";
import axios from "axios";
import trim_handler from "@/components/formula/trim_algorithm";
import LoadingScreen from "../testroute/LoadingScreen";

export default function Dashboard() {
  const [loading, setLoading] = useState(false);

  const [videoSrc, setVideoSrc] = useState<string>("");
  const [audioSrc, setAudioSrc] = useState<string>("");
  const [uploadedVideoFiles, setUploadedVideoFiles] = useState<MediaList>([]);
  const [uploadedAudioFiles, setUploadedAudioFiles] = useState<MediaList>([]);
  const [clipList, setClipList] = useState<MediaList>([]);
  const [audioClip, setAudioClip] = useState<MediaFile>();
  const [previewMediaType, setPreviewMediaType] = useState<string>("video");
  const [previewTimestamp, setPreviewTimestamp] = useState<number>(0);

  const [selectedClip, setSelectedClip] = useState<MediaFile>({
    display_name: "Sample Video",
    id: "video123",
    url: "https://example.com/sample-video.mp4",
    type: 0,
    duration: "00:03:30",
    startDelta: 5,
    endDelta: 10,
    flex: true,
    markers: [10, 20, 30, 40],
  });

  const router = useRouter();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files === null) return;

    const file = e.target.files[0];

    if (previewMediaType === "audio" && file.type.startsWith("audio/")) {
      const audioURL = URL.createObjectURL(file);

      setAudioSrc(audioURL);
      uploadToFirebase(
        file,
        "audio",
        setUploadedVideoFiles,
        setUploadedAudioFiles
      );
    } else if (previewMediaType === "video") {
      const videoURL = URL.createObjectURL(file);

      setVideoSrc(videoURL);
      uploadToFirebase(
        file,
        "video",
        setUploadedVideoFiles,
        setUploadedAudioFiles
      );
    }

  };

  const processClips = async () => {
    let timeStamp = Date.now();
    let jwt = (await auth.currentUser?.getIdToken()) || "";

    if (!audioClip) return;
    let newList = trim_handler(clipList, audioClip);

    await axios.post(
      "/api/merge",
      { list: newList, time: timeStamp },
      {
        headers: {
          Authorization: jwt,
        },
      }
    );

    setClipList(newList);
    setPreviewMediaType("video");
    setVideoSrc(`/api/video/output-${timeStamp}.mp4?token=${jwt}`);
  };

  const addClip = async (clip: MediaFile) => {
    let jwt = (await auth.currentUser?.getIdToken()) || "";

    await axios.post(
      "/api/download",
      { file_obj: clip },
      {
        headers: {
          Authorization: jwt,
        },
      }
    );

    if (clip.type == MediaType.Video) {
      setClipList([...clipList, clip]);
    } else {
      setAudioClip(clip);
    }
  };

  useEffect(() => {
    const authorizationLogic = async () => {
      await auth.authStateReady();

      if (auth.currentUser === null) {
        router.push("/signin");
      }
    };

    authorizationLogic();
    fetchMedia(setUploadedVideoFiles, setUploadedAudioFiles);
  }, []);

  if (loading) {
    return <LoadingScreen subtitle="Importing media ..." />;
  }

  return (
    <div className="h-screen bg-midnight overflow-hidden">
      <div className="py-4 text-center flex flex-row align-middle justify-around space-x-2 mt-2">
        <MediaLibrary
          previewMediaType={previewMediaType}
          setPreviewMediaType={setPreviewMediaType}
          uploadedVideoFiles={uploadedVideoFiles}
          uploadedAudioFiles={uploadedAudioFiles}
          handleFileUpload={handleFileUpload}
          setUploadedVideoFiles={setUploadedVideoFiles}
          setUploadedAudioFiles={setUploadedAudioFiles}
          setVideoSrc={setVideoSrc}
          setAudioSrc={setAudioSrc}
          addClip={addClip}
          selectedClip={selectedClip}
          setSelectedClip={setSelectedClip}
        />

        <div className="h-[50vh] m-auto w-[1px] rounded-lg border-dawn border-[1px]" />

        {previewMediaType == "video" ? (
          <VideoDisplay
            clipList={uploadedVideoFiles}
            videoSrc={videoSrc}
            timestamp={previewTimestamp}
          />
        ) : (
          <AudioDisplay audioSrc={audioSrc} timestamp={previewTimestamp} />
        )}
      </div>

      <div className="h-[1px] m-auto mt-4 w-[97vw] rounded-lg border-dawn border-[1px]" />

      <Timeline
        clipList={clipList}
        audioClip={audioClip}
        setClipList={setClipList}
        setAudioClip={setAudioClip}
        processClips={processClips}
        setPreviewTimestamp={setPreviewTimestamp}
        setPreviewMediaType={setPreviewMediaType}
        setVideoSrc={setVideoSrc}
        setAudioSrc={setAudioSrc}
      />
    </div>
  );
}
