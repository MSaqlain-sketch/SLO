# AKU AI

## Run the chatbot UI

The browser interface matches questions to the Grade XII Computer Science SLOs
in `data/grade_12_slos.json`, then grounds answers in retrieved textbook
passages. Questions without a matching SLO are declined; answers are not filled
in with general AI knowledge.

1. Add your `GROQ_API_KEY` to the project `.env` file. You can optionally set
   `GROQ_MODEL` there; the default is `openai/gpt-oss-120b`.
2. Install the Python dependencies:

   ```powershell
   .\rag_env\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

3. Start the web interface from the project folder:

   ```powershell
   streamlit run data/chat_ui.py --server.address 127.0.0.1
   ```

If the textbook index is missing, build it first with
`python data/rag_tutor.py --build`. Answers show the matched SLO and cite the
retrieved textbook PDF pages. The chat interface lets you start a fresh
conversation from the sidebar.

To continue using the original terminal chatbot, run
`python data/rag_tutor.py`.
