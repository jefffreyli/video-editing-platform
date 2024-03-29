import { spawn } from "child_process";
import { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: true,
  },
};

const execute = async (command: Array<string>) => {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", command);

    ffmpeg.stderr.on("data", (data) => {
      console.log(data.toString());
    });

    ffmpeg.once("error", reject);
    ffmpeg.on("exit", (code, signal) => {
      resolve();
    });
  });
};

export default async function NextApiHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({
      data: null,
      error: "Method Not Allowed",
    });
    return;
  }

  const fileList: Array<{
    name: string;
    id: string;
    duration: string;
    startDelta: number;
    endDelta: number;
  }> = req.body.list;
  const timeStamp = req.body.time;

  if (fileList.length <= 0) return res.status(200).end();

  let argsList = [];
  fileList.map((file, i) => {
    argsList.push(
      "-i",
      `${process.env.PWD}/public/${req.headers.userid}/${file.id}.mp4`
    );
  });

  let filterComplex = "";
  fileList.map((file, i) => {
    filterComplex += `[${i}:v:0]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:-1:-1:color=black,setsar=sar=1[Scaled_${i}];`;
  });

  fileList.map((file, i) => {
    filterComplex += `[Scaled_${i}]`;
  });

  filterComplex += `concat=n=${fileList.length}:v=1:a=0[v]`;

  argsList.push("-filter_complex", `${filterComplex}`);
  argsList.push(
    "-map",
    `[v]`,
    "-vsync",
    "2",
    "-y",
    "-preset",
    "faster",
    `${process.env.PWD}/public/${req.headers.userid}/output-tmp.mp4`
  );

  await execute(argsList);

  // CUTTING

  let timeSoFar: number = 0;
  let clipList_v: Array<string> = [];
  let clipList_a: Array<string> = [];

  for (let i = 0; i < fileList.length; i++) {
    let file = fileList[i];
    let clip_duration = parseFloat(file.duration);

    if (file.startDelta > 0) {
      clipList_v.push(
        `select='not(between(t,${timeSoFar},${timeSoFar + file.startDelta}))'`
      );
      clipList_a.push(
        `aselect='not(between(t,${timeSoFar},${timeSoFar + file.startDelta}))'`
      );
    }

    if (file.endDelta > 0) {
      clipList_v.push(
        `select='not(between(t,${timeSoFar + clip_duration - file.endDelta},${
          timeSoFar + clip_duration
        }))'`
      );
      clipList_a.push(
        `aselect='not(between(t,${timeSoFar + clip_duration - file.endDelta},${
          timeSoFar + clip_duration
        }))'`
      );
    }

    timeSoFar += clip_duration;
  }

  let argsList_trim = [
    "-i",
    `${process.env.PWD}/public/${req.headers.userid}/output-tmp.mp4`,
    "-vf",
    `${
      clipList_v.length > 0 ? clipList_v.join(",") + "," : ""
    }setpts=N/FRAME_RATE/TB`,
    "-af",
    `${clipList_a.length > 0 ? clipList_a.join(",") + "," : ""}asetpts=N/SR/TB`,
    `${process.env.PWD}/public/${req.headers.userid}/output-${timeStamp}.mp4`,
    "-vsync",
    "2",
    "-y",
    "-preset",
    "faster",
  ];

  await execute(argsList_trim);

  res.status(200).end();
}

/**
 * ffmpeg -i snow.mp4 -i fruit.mp4 -filter_complex "[0:v:0]scale=1920:1080,setsar=sar=1[Scaled];[1:v:0][Scaled] \
    concat=n=2:v=1:a=0 [v]" -map "[v]" output.mp4
 */
