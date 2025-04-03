export const fetchTopStories = async () => {
  const response = await fetch(
    "https://hacker-news.firebaseio.com/v0/topstories.json",
  );
  const data = await response.json();
  return data as number[];
};

export const fetchStory = async (id: number) => {
  const response = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
  );
  const data = await response.json();
  return data as {
    id: number;
    deleted?: boolean;
    type: "job" | "story" | "comment" | "poll" | "pollopt";
    by?: string;
    time: number;
    text?: string;
    dead?: boolean;
    parent?: number;
    poll?: number;
    kids?: number[];
    url?: string;
    score?: number;
    title?: string;
    parts?: number[];
    descendants?: number;
  };
};
