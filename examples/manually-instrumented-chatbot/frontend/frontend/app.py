import json
import os

import streamlit as st
from httpx import Client

from frontend.request_types import Message, MessagesPayload, MessagesResponse

http_client = Client()


CHAT_SERVICE_HOST = os.getenv("CHAT_SERVICE_HOST", "localhost")
MESSAGES_ENDPOINT = f"http://{CHAT_SERVICE_HOST}:8000/messages/"


st.title("Chat")

if "messages" not in st.session_state:
    st.session_state.messages = []

for user_message in st.session_state.messages:
    with st.chat_message(user_message.role):
        st.markdown(user_message.content)

if user_message_content := st.chat_input("Message"):
    user_message = Message(role="user", content=user_message_content)
    st.session_state.messages.append(user_message)
    payload = MessagesPayload(messages=st.session_state.messages)
    with st.chat_message("user"):
        st.markdown(user_message_content)
    with st.chat_message("assistant"):
        try:
            response = http_client.post(
                MESSAGES_ENDPOINT,
                json=payload.model_dump(),
            )
            if not (200 <= response.status_code < 300):
                raise Exception(response.content.decode("utf-8"))
        except Exception as error:
            try:
                error_data = json.loads(str(error))
                st.error("An error occurred")
                st.json(error_data)
            except json.JSONDecodeError:
                st.error(f"An error occurred: {error}")
        else:
            messages_response = MessagesResponse.model_validate(response.json())
            assistant_message = messages_response.message
            st.markdown(assistant_message.content)
            st.session_state.messages.append(assistant_message)
