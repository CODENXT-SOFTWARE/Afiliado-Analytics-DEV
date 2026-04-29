declare module "react-tagcloud" {
  import type { CSSProperties, ReactNode } from "react";

  export type TagCloudTag = {
    value: string;
    count: number;
    key?: string | number;
  };

  export type CustomRendererProps<T extends TagCloudTag = TagCloudTag> = {
    tag: T;
    size: number;
    color: string;
  };

  export type TagCloudProps<T extends TagCloudTag = TagCloudTag> = {
    tags: T[];
    minSize: number;
    maxSize: number;
    colorOptions?: { luminosity?: string; hue?: string };
    onClick?: (tag: T, event: React.MouseEvent) => void;
    renderer?: (tag: T, size: number, color: string) => ReactNode;
    shuffle?: boolean;
    disableRandomColor?: boolean;
    randomNumberGenerator?: () => number;
    className?: string;
    style?: CSSProperties;
  };

  export const TagCloud: <T extends TagCloudTag = TagCloudTag>(
    props: TagCloudProps<T>,
  ) => JSX.Element;
}
