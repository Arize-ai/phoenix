import json
import os
from uuid import uuid4

import streamlit as st
from httpx import Client

from request_types import Message, MessagesPayload, MessagesResponse
from utils import post_feedback

http_client = Client()


CHAT_SERVICE_HOST = os.getenv("CHAT_SERVICE_HOST", "localhost")
MESSAGES_ENDPOINT = f"http://{CHAT_SERVICE_HOST}:8000/messages/"


st.title("Chat")

if "messages" not in st.session_state:
    st.session_state.messages = []
    
for  message in st.session_state.messages:
    with st.chat_message(message.role):
        st.markdown(message.content)
        if message.role == "assistant":
            col1, col2 = st.columns(2, gap="small")
            col1.button("👍", key=f"thumbs_up_{message.uuid}", on_click=lambda uuid=message.uuid: post_feedback(1, uuid))
            col2.button("👎", key=f"thumbs_down_{message.uuid}", on_click=lambda uuid=message.uuid: post_feedback(0, uuid))
            
if user_message_content := st.chat_input("Message"):
    message_uuid = str(uuid4())
    user_message = Message(role="user", content=user_message_content, uuid=message_uuid)
    st.session_state.messages.append(user_message)
    with st.chat_message(user_message.role):
        st.markdown(user_message.content)
    payload = MessagesPayload(messages=st.session_state.messages)
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
        with st.chat_message(assistant_message.role):
                st.markdown(assistant_message.content)
                col1, col2 = st.columns(2, gap="small")
                col1.button("👍", key=f"thumbs_up_{assistant_message.uuid}", on_click=lambda: post_feedback(1, assistant_message.uuid))
                col2.button("👎", key=f"thumbs_down_{assistant_message.uuid}", on_click=lambda: post_feedback(0, assistant_message.uuid))
        st.session_state.messages.append(assistant_message)
