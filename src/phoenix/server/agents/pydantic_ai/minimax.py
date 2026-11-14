"""MiniMax media content serialization for chat completions."""

from typing import Any, cast

from openai.types.chat import ChatCompletionContentPartImageParam, ChatCompletionContentPartParam
from pydantic_ai.exceptions import UserError
from pydantic_ai.messages import ImageUrl, VideoUrl
from pydantic_ai.models.openai import OpenAIChatModel

MINIMAX_MEDIA_MODELS = frozenset({"MiniMax-M3"})


class MiniMaxChatModel(OpenAIChatModel):
    async def _map_image_url_item(self, item: ImageUrl) -> ChatCompletionContentPartImageParam:
        self._validate_media_model()
        part = await super()._map_image_url_item(item)
        if metadata := item.vendor_metadata:
            image_url = cast(dict[str, Any], part["image_url"])
            if "detail" not in metadata:
                image_url.pop("detail", None)
            if "max_long_side_pixel" in metadata:
                image_url["max_long_side_pixel"] = metadata["max_long_side_pixel"]
        return part

    async def _map_video_url_item(self, item: VideoUrl) -> ChatCompletionContentPartParam:
        self._validate_media_model()
        video_url: dict[str, Any] = {"url": item.url}
        if metadata := item.vendor_metadata:
            for key in ("detail", "fps", "max_long_side_pixel"):
                if key in metadata:
                    video_url[key] = metadata[key]
        # The SDK's content-part union does not include MiniMax's video extension.
        return cast(ChatCompletionContentPartParam, {"type": "video_url", "video_url": video_url})

    def _validate_media_model(self) -> None:
        if self.model_name not in MINIMAX_MEDIA_MODELS:
            raise UserError("Media input is not supported by this MiniMax model.")
