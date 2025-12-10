export type CompanionMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CompanionRequest = {
  messages: CompanionMessage[];
};

export type CompanionResponse = {
  reply: string;
};

