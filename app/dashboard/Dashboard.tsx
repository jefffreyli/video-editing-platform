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
import { signOut } from "firebase/auth";
import axios from "axios";
import Link from "next/link";
import Image from "next/image";

export default function Dashboard() {
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [audioSrc, setAudioSrc] = useState<string>("");

  const [uploadedVideoFiles, setUploadedVideoFiles] = useState<MediaList>([]);
  const [uploadedAudioFiles, setUploadedAudioFiles] = useState<MediaList>([]);
  const [previewMediaType, setPreviewMediaType] = useState<string>("video");

  const [clipList, setClipList] = useState<MediaList>([]);
  const [audioClip, setAudioClip] = useState<MediaFile>();

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

    await axios.post(
      "/api/merge",
      { list: clipList, time: timeStamp },
      {
        headers: {
          Authorization: jwt,
        },
      }
    );

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
      setClipList([...clipList]);
      setAudioClip(clip);
      console.log(clip);
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

  useEffect(() => {
    if (clipList.length <= 0) return;

    processClips();
  }, [clipList]);

  return (
    <div className="h-80">
      <div className="py-4 rounded-lg text-center flex bg-background">
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
        />
        <div className="border-[0.9px] border-gray-300"> </div>
        {previewMediaType == "video" ? (
          <VideoDisplay videoSrc={videoSrc} />
        ) : (
          <AudioDisplay audioSrc={audioSrc} />
        )}
      </div>
      <div className="">
        <Timeline
          clipList={clipList}
          audioClip={audioClip}
          setClipList={setClipList}
        />
      </div>
    </div>
  );
}
