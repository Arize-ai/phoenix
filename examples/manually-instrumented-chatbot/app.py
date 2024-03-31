import json

import streamlit as st
from httpx import Client

from chat.types import Message, MessagesPayload, MessagesResponse

http_client = Client()


MESSAGES_ENDPOINT = "http://localhost:8000/messages/"


st.title("Chat")

if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message.role):
        st.markdown(message.content)

if user_message_content := st.chat_input("Message"):
    st.session_state.messages.append(Message(role="user", content=user_message_content))
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
