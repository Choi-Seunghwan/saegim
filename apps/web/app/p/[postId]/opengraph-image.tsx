import { ImageResponse } from "next/og";
import { fetchPublicPost } from "../../../src/lib/public-api";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

type PublicPostOgImageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function PostOpenGraphImage({ params }: PublicPostOgImageProps) {
  const { postId } = await params;
  const post = await fetchPublicPost(postId);
  const card = post.cards[0];
  const background = card?.comp.bg || "linear-gradient(150deg,#F4F1F3,#E7E5EA 55%,#D8DAE4)";
  const textColor = card?.comp.textColor || "#38323F";
  const sentence = card?.text || post.post.title;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#F6F5F6",
          color: "#38323F",
          fontFamily: "serif",
          padding: 54
        }}
      >
        <div
          style={{
            width: 390,
            height: 522,
            display: "flex",
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            background,
            boxShadow: "0 28px 70px rgba(60,45,70,0.22)",
            color: textColor,
            padding: 48
          }}
        >
          <div
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              whiteSpace: "pre-wrap",
              lineHeight: 1.45,
              fontSize: 34,
              fontWeight: 700
            }}
          >
            {sentence}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: 64
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              opacity: 0.64,
              marginBottom: 22
            }}
          >
            새김
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 58,
              fontWeight: 800,
              lineHeight: 1.18,
              letterSpacing: 0,
              maxWidth: 620
            }}
          >
            {post.post.title}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              color: "#6E6A74",
              fontSize: 28,
              fontWeight: 600
            }}
          >
            {post.author.displayName} · {post.post.cardCount}장
          </div>
        </div>
      </div>
    ),
    size
  );
}
