# Computer Use Agent Examples  

## Overview  

This repository contains examples for building a **Computer Use (Operator) Agent** using **LangGraph** and **Anthropic**. The agent leverages Anthropic's **beta APIs** to perform various computer-related tasks, including executing Bash commands, editing files, and performing system operations.  

**⚠️ Important:** Since the agent can execute system-level operations, it is recommended to run it inside a **virtual machine (VM)** for safety. To facilitate this, we provide **Docker files** to set up an **Ubuntu virtual machine** and **noVNC** for accessing the VM via a web browser.  

**💡 Note:** All the tools used in this example are **Ubuntu compatible**.  

---  

## Features  
- **UI:** Built with Gradio app
- **Computer Use Agent Workflow:** Built using **LangGraph**
- **Anthropic Model Integration:** Uses **Anthropic's Computer Use beta models**
- **Prebuilt Tools:** Includes tools for **Bash execution, file editing, and system operations**
- **Instrumentation with Phoenix:**  Auto-instrumentation with OpenInference decorators to fully instrument the agent
- **End-to-end tracing:** Track agent performance using Phoenix


---  

## Requirements  

- **Anthropic API Key**  
- **Python 3.x**  
- **LangGraph library**  
- **Phoenix for instrumentation**  
- **Gradio for UI**
---  

## Installation  

💡 **No need to install dependencies manually!** The required libraries are already included in the **Docker image**.  
Just Run the docker image with docker command, open a web browser and access the Ubuntu environment using **noVNC**.

---  

## Usage  

### 1. Start the Virtual Machine Using Docker  
First, build the Docker image:  
```sh  
docker build -t computer-use-agent:1.0 .  
```  
Run the container:  
```sh  
docker run -v $HOME/.anthropic:/home/computeruse/.anthropic \  
           -p 5900:5900 -p 7860:7860 -p 6080:6080 -p 8080:8080 \  
           -it computer-use-agent:1.0  
```  

### 2. Access the Virtual Machine  
Once the container is running, access the Ubuntu environment using **noVNC**:  

- Open a web browser and visit:  
  ```  
  http://localhost:8080  
  ```  

### 3. Input all the required configurations in the webpage

* **Anthropic API Key**
* **Phoenix API Key**
* **Phoenix Collector Endpoint**
* **Phoenix Project Name**

### 4. Run the Agent
- Provide input commands, and the agent will execute them inside the **Ubuntu virtual machine**.  
- Monitor system actions via the **VNC interface**.  

---  

## File Structure  
- **`app.py`** – Main script for running the agent.
- **`agent.py`** – Agent script.  
- **`tools/`** – Contains utilities for computer, bash, edit file tools.  
- **`requirements.txt`** – List of required dependencies (**already included in the Docker image**).  

---  

## Notes  

- Ensure you run the agent inside a **virtual machine** to prevent unintended system modifications.  
- **All tools used in this model are Ubuntu compatible.**