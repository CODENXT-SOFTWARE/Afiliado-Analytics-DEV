import React from "react";
import type { VideoInputProps } from "./types";
import { ShowcaseVideo } from "./templates/ShowcaseVideo";
import { FastCutsVideo } from "./templates/FastCutsVideo";
import { StorytellingVideo } from "./templates/StorytellingVideo";
import { BeforeAfterVideo } from "./templates/BeforeAfterVideo";
import { ReviewRapidoVideo } from "./templates/ReviewRapidoVideo";
import { UGCStyleVideo } from "./templates/UGCStyleVideo";
import { FlashSaleVideo } from "./templates/FlashSaleVideo";
import { UnboxingVideo } from "./templates/UnboxingVideo";

export const VideoComposition: React.FC<VideoInputProps> = (props) => {
  switch (props.style) {
    case "fastCuts":
      return <FastCutsVideo {...props} />;
    case "storytelling":
      return <StorytellingVideo {...props} />;
    case "beforeAfter":
      return <BeforeAfterVideo {...props} />;
    case "reviewRapido":
      return <ReviewRapidoVideo {...props} />;
    case "ugcStyle":
      return <UGCStyleVideo {...props} />;
    case "flashSale":
      return <FlashSaleVideo {...props} />;
    case "unboxing":
      return <UnboxingVideo {...props} />;
    case "showcase":
    default:
      return <ShowcaseVideo {...props} />;
  }
};
