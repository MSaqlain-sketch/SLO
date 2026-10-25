"""Streamlit chat interface for the Grade XII Computer Science RAG tutor."""
import base64
import os
import pickle
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv
from groq import Groq

BASE = Path(__file__).resolve().parent


@st.cache_resource
def load_tutor():
    from rag_tutor import INDEX_FILE, ask_groq, find_slo, load_slos, retrieve

    load_dotenv(str(BASE / ".env"))
    load_dotenv(str(BASE.parent / ".env"))

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY was not found in data/.env or the project .env file."
        )
    if not INDEX_FILE.is_file():
        raise RuntimeError(
            "The textbook index is missing. Build it with: "
            "python data/rag_tutor.py --build"
        )

    with INDEX_FILE.open("rb") as index_file:
        index = pickle.load(index_file)

    return (
        index,
        Groq(api_key=api_key),
        os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
        ask_groq,
        find_slo,
        load_slos(),
        retrieve,
    )


def render_message(message):
    is_assistant = message["role"] == "assistant"
    with st.chat_message(
        "AKU AI" if is_assistant else "You",
        avatar="✨" if is_assistant else "👤",
    ):
        if message.get("error"):
            st.error(message["content"])
        else:
            st.markdown(message["content"])
        pages = message.get("pages", [])
        if pages:
            page_list = ", ".join(str(page) for page in pages)
            st.caption("📖 Textbook source · PDF pages {}".format(page_list))
        slo = message.get("slo")
        if slo:
            st.caption("Syllabus SLO · {} — {}".format(slo["slo_code"], slo["statement"]))


def main():
    st.set_page_config(
        page_title="AKU AI",
        page_icon=str(BASE / "aku_logo.svg"),
        layout="wide",
    )
    logo_data = base64.b64encode((BASE / "aku_logo.svg").read_bytes()).decode("ascii")

    st.markdown(
        """
        <style>
        :root {
            color-scheme: light;
            --ink: #14213d;
            --muted: #697891;
            --blue: #3867ed;
        }
        .stApp {
            background: #f5f7fb;
            color: var(--ink);
        }
        [data-testid="stHeader"] {
            background: transparent;
        }
        [data-testid="stMainBlockContainer"] {
            max-width: 1040px;
            padding-top: 2rem;
            padding-bottom: 7rem;
        }
        [data-testid="stSidebar"] {
            background: #101a30;
            border-right: 1px solid #24314a;
        }
        [data-testid="stSidebar"] * {
            color: #e9effb;
        }
        [data-testid="stSidebar"] [data-testid="stButton"] button {
            min-height: 2.9rem;
            border: 1px solid #36435c;
            border-radius: 10px;
            background: #202d45;
            color: #f7f9ff;
        }
        [data-testid="stSidebar"] [data-testid="stButton"] button:hover {
            border-color: #90aaff;
            background: #2a3a58;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin: 0.2rem 0 1.5rem;
        }
        .brand-mark {
            width: 42px;
            height: 42px;
            border-radius: 13px;
            box-shadow: 0 7px 18px #3867ed45;
        }
        .brand-name {
            color: #fff;
            font-size: 1.1rem;
            font-weight: 750;
            letter-spacing: -0.03em;
        }
        .brand-caption {
            margin-top: 1px;
            color: #9caac0;
            font-size: 0.75rem;
        }
        .side-label {
            margin: 1.3rem 0 0.65rem;
            color: #9caac0;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
        }
        .sidebar-note {
            padding: 0.95rem;
            border: 1px solid #293750;
            border-radius: 12px;
            background: #18243a;
            color: #aebbd0;
            font-size: 0.83rem;
            line-height: 1.55;
        }
        .hero {
            position: relative;
            display: flex;
            min-height: 205px;
            align-items: center;
            justify-content: space-between;
            overflow: hidden;
            padding: 2.15rem 2.4rem;
            margin: 0.2rem 0 2rem;
            border: 1px solid #244677;
            border-radius: 22px;
            background: linear-gradient(112deg, #111c35 0%, #173963 66%, #22588b 100%);
            box-shadow: 0 16px 40px #17396318;
        }
        .hero-copy {
            position: relative;
            z-index: 1;
            max-width: 610px;
        }
        .hero-kicker {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            padding: 0.36rem 0.7rem;
            border: 1px solid #ffffff30;
            border-radius: 99px;
            background: #ffffff10;
            color: #dceaff;
            font-size: 0.75rem;
            font-weight: 650;
        }
        .hero h1 {
            margin: 1rem 0 0.55rem;
            color: #fff;
            font-size: clamp(1.8rem, 4vw, 2.65rem);
            font-weight: 760;
            letter-spacing: -0.045em;
            line-height: 1.13;
        }
        .hero p {
            max-width: 490px;
            margin: 0;
            color: #c4d4e9;
            font-size: 0.97rem;
            line-height: 1.6;
        }
        .hero-orbit {
            position: absolute;
            top: -97px;
            right: -20px;
            width: 320px;
            height: 320px;
            border: 1px solid #ffffff1d;
            border-radius: 50%;
        }
        .hero-orbit:before,
        .hero-orbit:after {
            position: absolute;
            border: 1px solid #ffffff1b;
            border-radius: 50%;
            content: "";
        }
        .hero-orbit:before {
            inset: 30px;
        }
        .hero-orbit:after {
            inset: 68px;
        }
        .hero-star {
            position: absolute;
            top: 76px;
            right: 115px;
            color: #c6dcff;
            font-size: 3rem;
            text-shadow: 0 0 28px #a3c7ff99;
        }
        .section-heading {
            margin: 0 0 0.25rem;
            color: #17233b;
            font-size: 1.18rem;
            font-weight: 730;
            letter-spacing: -0.025em;
        }
        .section-caption {
            margin: 0 0 1rem;
            color: #718097;
            font-size: 0.88rem;
        }
        [data-testid="stMain"] [data-testid="stButton"] button {
            min-height: 5rem;
            padding: 0.8rem 0.95rem;
            border: 1px solid #e1e7f0;
            border-radius: 14px;
            background: #fff;
            color: #25324a;
            font-size: 0.84rem;
            font-weight: 560;
            line-height: 1.45;
            text-align: left;
            white-space: normal;
            box-shadow: 0 4px 14px #1e34500a;
            transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
        }
        [data-testid="stMain"] [data-testid="stButton"] button:hover {
            transform: translateY(-2px);
            border-color: #9bb6ff;
            color: #244fd0;
            box-shadow: 0 8px 20px #244fd014;
        }
        div[data-testid="stChatMessage"] {
            margin: 0.8rem 0;
            padding: 1rem 1.1rem;
            border: 1px solid #e6eaf1;
            border-radius: 17px;
            background: #fff;
            box-shadow: 0 4px 16px #1e345008;
        }
        [data-testid="stChatInput"] {
            border-color: #dce3ee;
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 8px 28px #1e345014;
        }
        [data-testid="stChatInput"] textarea {
            font-size: 0.95rem;
        }
        @media (max-width: 640px) {
            [data-testid="stMainBlockContainer"] {
                padding: 1.2rem 1rem 6rem;
            }
            .hero {
                min-height: 185px;
                padding: 1.5rem;
                border-radius: 17px;
            }
            .hero-orbit {
                right: -215px;
            }
            .hero-star {
                display: none;
            }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    with st.sidebar:
        st.markdown(
            """
            <div class="brand">
                <img class="brand-mark" src="data:image/svg+xml;base64,{}" alt="AKU AI logo">
                <div>
                    <div class="brand-name">AKU AI</div>
                    <div class="brand-caption">Your personal study tutor</div>
                </div>
            </div>
            """.format(logo_data),
            unsafe_allow_html=True,
        )
        if st.button("＋   New conversation", use_container_width=True):
            st.session_state.messages = []
            st.rerun()
        st.divider()
        st.markdown('<div class="side-label">Your study space</div>', unsafe_allow_html=True)
        st.markdown(
            '<div class="sidebar-note">📚 &nbsp; Grade XII<br>'
            '💻 &nbsp; Computer Science<br>'
            '✍️ &nbsp; Exam-ready answers</div>',
            unsafe_allow_html=True,
        )
        st.markdown('<div class="side-label">Get better answers</div>', unsafe_allow_html=True)
        st.markdown(
            '<div class="sidebar-note">Include the number of marks in your question '
            'for an answer sized to your exam. Textbook page references appear with '
            'each response.</div>',
            unsafe_allow_html=True,
        )

    st.markdown(
        """
        <div class="hero">
            <div class="hero-copy">
                <span class="hero-kicker">✦ &nbsp; YOUR AI STUDY PARTNER</span>
                <h1>Make every study<br>session count.</h1>
                <p>Ask your Computer Science question. Get a clear, textbook-grounded answer, ready for the exam.</p>
            </div>
            <div class="hero-orbit"><span class="hero-star">✦</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if "messages" not in st.session_state:
        st.session_state.messages = []

    suggested_question = None
    if not st.session_state.messages:
        st.markdown('<div class="section-heading">A good place to start</div>', unsafe_allow_html=True)
        st.markdown(
            '<div class="section-caption">Choose a question, or type your own below.</div>',
            unsafe_allow_html=True,
        )
        suggestions = [
            ("SLO 10.1.1 · 2 marks", "Define data structure (2 marks)"),
            ("SLO 10.2.3 · 3 marks", "Explain push and pop operations in a stack (3 marks)"),
            ("SLO 9.2.1 · 3 marks", "Describe HCI and its importance (3 marks)"),
        ]
        columns = st.columns(len(suggestions))
        for column, (label, question) in zip(columns, suggestions):
            if column.button(label, use_container_width=True):
                suggested_question = question

    for message in st.session_state.messages:
        render_message(message)

    question = st.chat_input("Ask a Computer Science question...")
    question = question or suggested_question
    if question:
        st.session_state.messages.append({"role": "user", "content": question})
        render_message(st.session_state.messages[-1])

        with st.chat_message("AKU AI", avatar="✨"):
            with st.spinner("Finding textbook passages and preparing your answer..."):
                try:
                    index, client, model, ask_groq, find_slo, slos, retrieve = load_tutor()
                    slo = find_slo(question, index, slos)
                    if slo is None:
                        matches = []
                        answer = ask_groq(question, matches, client, model)
                    else:
                        search_question = "{} {}".format(question, slo["statement"])
                        matches = retrieve(search_question, index)
                        answer = ask_groq(question, matches, client, model, slo)
                except Exception as exc:
                    error_message = "I couldn't generate an answer: {}: {}".format(
                        type(exc).__name__, exc
                    )
                    st.error(error_message)
                    st.session_state.messages.append(
                        {
                            "role": "assistant",
                            "content": error_message,
                            "error": True,
                        }
                    )
                else:
                    st.markdown(answer)
                    pages = (
                        list(dict.fromkeys(doc["page"] for doc, _ in matches))
                        if matches and matches[0][1] >= 0.08
                        else []
                    )
                    if pages:
                        page_list = ", ".join(str(page) for page in pages)
                        st.caption("Textbook PDF pages: {}".format(page_list))
                    if slo:
                        st.caption(
                            "Syllabus SLO · {} — {}".format(
                                slo["slo_code"], slo["statement"]
                            )
                        )
                    st.session_state.messages.append(
                        {
                            "role": "assistant",
                            "content": answer,
                            "pages": pages,
                            "slo": slo,
                        }
                    )


if __name__ == "__main__":
    main()
