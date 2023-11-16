def get_tqdm_progress_bar_formatter(title: str) -> str:
    """
    Returns a progress bar formatter for use with tqdm.
    """
    return (
        title + " |{bar}| {n_fmt}/{total_fmt} ({percentage:3.1f}%) "
        "| ⏳ {elapsed}<{remaining} | {rate_fmt}{postfix}"
    )
