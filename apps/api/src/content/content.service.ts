import { Injectable, NotFoundException } from "@nestjs/common";
import { seedAccounts, seedPostBundles } from "./seed-data.js";

@Injectable()
export class ContentService {
  getFeed() {
    return {
      items: seedPostBundles
    };
  }

  getShelf() {
    return {
      items: [...seedPostBundles].sort((a, b) => {
        const bLikes = b.viewerState?.likeCount ?? 0;
        const aLikes = a.viewerState?.likeCount ?? 0;
        return bLikes - aLikes;
      })
    };
  }

  getPost(postId: string) {
    const post = seedPostBundles.find((item) => item.post.id === postId);
    if (!post) {
      throw new NotFoundException("글을 찾을 수 없어요.");
    }

    return post;
  }

  getRecommendedAccounts() {
    return {
      items: seedAccounts.filter((account) => account.id !== "acct-me")
    };
  }
}
