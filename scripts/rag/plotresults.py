# type:ignore
import os
from typing import Dict

import pandas as pd
from matplotlib import pyplot as plt  # type:ignore


def remove_all_zeros_rows(df: pd.DataFrame) -> pd.DataFrame:
    filtered_df = df[
        (
            df[
                [
                    "context_precision_at_1",
                    "context_precision_at_2",
                    "context_precision_at_3",
                    "context_precision_at_4",
                ]
            ]
            != 0
        ).any(axis=1)
    ]
    return filtered_df


def plot_mrr_graphs(
    all_data: Dict[int, Dict[str, Dict[int, pd.DataFrame]]],
    save_dir: str = "./",
    show: bool = True,
    remove_zero: bool = True,
) -> None:
    # Determine the number of rows (distinct chunk sizes) and columns (methods) for the subplot grid
    chunk_sizes = list(all_data.keys())
    n_rows = len(chunk_sizes)
    n_cols = max(len(method_data) for method_data in all_data.values())

    # Compute the global minimum and maximum MRR for setting consistent Y-axis
    min_mrr = 0
    max_mrr = 1.1
    # Create a figure with subplots
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 5 * n_rows), squeeze=False)

    for i, (chunk_size, method_data) in enumerate(sorted(all_data.items())):
        for j, (method, k_data) in enumerate(sorted(method_data.items())):
            mrrs_dict = {}

            for k, df in k_data.items():
                if remove_zero:
                    df = remove_all_zeros_rows(df)
                if method == "multistep":
                    continue
                mrr_i = (1 / df[f"rank_at_{k}"]).mean()
                mrrs_dict[k] = mrr_i

            # Convert the dictionary to a DataFrame for easier plotting
            df_mrrs = pd.Series(mrrs_dict).to_frame(name="MRR")

            # Plot on the respective subplot axis
            df_mrrs.plot(kind="bar", ax=axes[i][j], legend=False, ylim=[min_mrr, max_mrr])
            axes[i][j].set_title(f"Chunk Size = {chunk_size}, Method = {method}")
            axes[i][j].set_ylabel("MRR")

            # Add legend to the last plot in a row
            if j == n_cols - 1:
                axes[i][j].legend(title="K", bbox_to_anchor=(1, 1))

    # Adjust layout and save
    plt.tight_layout()
    plt.savefig(f"{save_dir}/all_mrr.png")

    if show:
        plt.show()
    else:
        plt.close(fig)


def plot_ndcg_graphs(
    all_data: Dict[int, Dict[str, Dict[int, pd.DataFrame]]],
    save_dir: str = "./",
    show: bool = True,
    remove_zero: bool = True,
) -> None:
    # Determine the number of rows (distinct chunk sizes) and columns (methods) for the subplot grid
    chunk_sizes = list(all_data.keys())
    n_rows = len(chunk_sizes)
    n_cols = max(len(method_data) for method_data in all_data.values())

    max_average_ndcg = 1.1
    # Get unique 'k' values for consistent X-axis
    set(k for method_data in all_data.values() for k in method_data.keys())

    # Create a figure with subplots
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 5 * n_rows), squeeze=False)

    for i, (chunk_size, method_data) in enumerate(sorted(all_data.items())):
        for j, (method, k_data) in enumerate(sorted(method_data.items())):
            average_ndcgs_dict = {}

            for k, df in k_data.items():
                if remove_zero:
                    df = remove_all_zeros_rows(df)
                if method == "multistep":
                    continue
                average_ndcg_i = df[f"ndcg_at_{k}"].mean()
                average_ndcgs_dict[k] = average_ndcg_i

            # Convert the dictionary to a DataFrame for easier plotting
            df_average_ndcgs = pd.Series(average_ndcgs_dict).to_frame(name="Average NDCG")

            # Plot on the respective subplot axis
            df_average_ndcgs.plot(kind="bar", ax=axes[i][j], legend=False)
            axes[i][j].set_title(f"Chunk Size = {chunk_size}, Method = {method}")
            axes[i][j].set_ylabel("Average NDCG")
            axes[i][j].set_ylim(
                0, max_average_ndcg * 1.1
            )  # Set consistent Y-axis with a small margin

            # Add legend to the last plot in a row
            if j == n_cols - 1:
                axes[i][j].legend(title="K", bbox_to_anchor=(1, 1))

    # Adjust layout and save
    plt.tight_layout()
    plt.savefig(f"{save_dir}/all_ndcg.png")

    if show:
        plt.show()
    else:
        plt.close(fig)


def plot_latency_graphs(
    all_data: Dict[int, Dict[str, Dict[int, pd.DataFrame]]],
    save_dir: str = "./",
    show: bool = True,
) -> None:
    # Determine the number of rows (distinct chunk sizes) and columns (methods) for the subplot grid
    chunk_sizes = list(all_data.keys())
    n_rows = len(chunk_sizes)
    n_cols = max(len(method_data) for method_data in all_data.values())

    # Compute the global maximum median latency for setting consistent Y-axis
    max_median_latency = 0.0
    for _, method_data in all_data.items():
        for _, k_data in method_data.items():
            for _, df in k_data.items():
                current_median = df["response_latency"].median()
                if current_median > max_median_latency:
                    max_median_latency = current_median

    # Get unique 'k' values for consistent X-axis
    set(k for method_data in all_data.values() for k in method_data.keys())

    # Create a figure with subplots
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 5 * n_rows), squeeze=False)

    # Iterate over all_data items to plot graphs
    for i, (chunk_size, method_data) in enumerate(sorted(all_data.items())):
        for j, (method, k_data) in enumerate(sorted(method_data.items())):
            median_latency_dict = {}

            for k, df in k_data.items():
                median_latency = df["response_latency"].median()
                median_latency_dict[k] = median_latency

            # Convert the dictionary to a DataFrame for easier plotting
            df_median_latency = pd.Series(median_latency_dict).to_frame(name="Median Latency")

            # Plot on the respective subplot axis
            df_median_latency.plot(kind="bar", ax=axes[i][j], legend=False)
            axes[i][j].set_title(f"Chunk Size = {chunk_size}, Method = {method}")
            axes[i][j].set_ylabel("Median Latency (seconds)")
            axes[i][j].set_ylim(
                0, max_median_latency * 1.1
            )  # Set consistent Y-axis with a small margin

            # Add legend to the last plot in a row
            if j == n_cols - 1:
                axes[i][j].legend(title="K", bbox_to_anchor=(1, 1))

    # Adjust layout and save
    plt.tight_layout()
    plt.savefig(os.path.join(save_dir, "median_latency_all.png"))

    if show:
        plt.show()
    else:
        plt.close(fig)


def plot_mean_average_precision_graphs(
    all_data: Dict[int, Dict[str, Dict[int, pd.DataFrame]]],
    save_dir: str = "./",
    show: bool = True,
    remove_zero: bool = True,
) -> None:
    # Determine the number of rows (distinct chunk sizes) and columns (methods) for the subplot grid
    chunk_sizes = list(all_data.keys())
    n_rows = len(chunk_sizes)
    n_cols = max(len(method_data) for method_data in all_data.values())

    max_macp = 1.1
    # Get unique 'k' values for consistent X-axis
    set(k for method_data in all_data.values() for k in method_data.keys())

    # Create a figure with subplots
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 5 * n_rows), squeeze=False)

    for i, (chunk_size, method_data) in enumerate(sorted(all_data.items())):
        for j, (method, k_data) in enumerate(sorted(method_data.items())):
            mean_average_precisions_dict = {}

            for k, df in k_data.items():
                if remove_zero:
                    df = remove_all_zeros_rows(df)
                if method == "multistep":
                    continue
                macp_i = df[f"average_context_precision_at_{k}"].mean()
                mean_average_precisions_dict[k] = macp_i

            # Convert the dictionary to a DataFrame for easier plotting
            df_mean_average_precisions = pd.Series(mean_average_precisions_dict).to_frame(
                name="MACP"
            )

            # Plot on the respective subplot axis
            df_mean_average_precisions.plot(kind="bar", ax=axes[i][j], legend=False)
            axes[i][j].set_title(f"Chunk Size = {chunk_size}, Method = {method}")
            axes[i][j].set_ylabel("MACP")
            axes[i][j].set_ylim(0, max_macp * 1.1)  # Set consistent Y-axis with a small margin

            # Add legend to the last plot in a row
            if j == n_cols - 1:
                axes[i][j].legend(title="K", bbox_to_anchor=(1, 1))

    # Adjust layout and save
    plt.tight_layout()
    plt.savefig(f"{save_dir}/all_macp.png")

    if show:
        plt.show()
    else:
        plt.close(fig)


def plot_mean_precision_graphs(
    all_data: Dict[int, Dict[str, Dict[int, pd.DataFrame]]],
    save_dir: str = "./",
    show: bool = True,
    remove_zero: bool = True,
) -> None:
    # Determine the number of rows (distinct chunk sizes) and columns (methods) for the subplot grid
    chunk_sizes = list(all_data.keys())
    n_rows = len(chunk_sizes)
    n_cols = max(len(method_data) for method_data in all_data.values())

    # Create a figure with subplots
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 5 * n_rows), squeeze=False)

    # To make the y-height equal for all graphs
    max_y_val = 1.1
    # Iterate over all_data items to plot graphs
    for i, (chunk_size, method_data) in enumerate(sorted(all_data.items())):
        for j, (method, k_data) in enumerate(sorted(method_data.items())):
            mean_precisions_dict = {}

            for k, df in k_data.items():
                if remove_zero:
                    df = remove_all_zeros_rows(df)
                if method == "multistep":
                    continue
                mean_precision_i = df[f"context_precision_at_{k}"].mean()
                mean_precisions_dict[k] = mean_precision_i

            # Convert the dictionary to a DataFrame for easier plotting
            df_mean_precisions = pd.Series(mean_precisions_dict).to_frame(name="Mean Precision")

            # Plot on the respective subplot axis
            df_mean_precisions.plot(kind="bar", ax=axes[i][j], legend=False)
            axes[i][j].set_title(f"Chunk Size = {chunk_size}, Method = {method}")
            axes[i][j].set_ylabel("Mean Precision")
            axes[i][j].set_ylim(0, max_y_val)  # Setting equal y-height for all plots

            # Add legend to the last plot in a row
            if j == n_cols - 1:
                axes[i][j].legend(title="K", bbox_to_anchor=(1, 1))

    # Adjust layout and save
    plt.tight_layout()
    plt.savefig(os.path.join(save_dir, "all_mean_precisions.png"))

    if show:
        plt.show()
    else:
        plt.close(fig)


def plot_percentage_incorrect(
    all_data: Dict[int, Dict[str, Dict[int, pd.DataFrame]]],
    save_dir: str = "./",
    show: bool = True,
    remove_zero: bool = True,
) -> None:
    """
    Plot the percentage of 'incorrect' values for each chunk, method, and k.

    :param all_data: Dictionary containing data grouped by 'chunk_size', 'method', and 'k'.
    :param save_dir: Directory where the output plot will be saved.
    :param show: Whether to display the plot.
    """
    chunk_sizes = list(all_data.keys())
    n_rows = len(chunk_sizes)
    n_cols = max(
        len(method_data) * max(len(k_data) for k_data in method_data.values())
        for method_data in all_data.values()
    )

    # Create a figure with subplots
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 5 * n_rows), squeeze=False)

    for i, (chunk_size, method_data) in enumerate(sorted(all_data.items())):
        col_counter = 0  # Reset column counter for each chunk_size
        for j, (method, k_data) in enumerate(sorted(method_data.items())):
            for k, df in k_data.items():
                if remove_zero:
                    df = remove_all_zeros_rows(df)
                # Calculate the percentage of "incorrect" values
                percent_incorrect = (
                    df["qa_evals"].value_counts(normalize=True).get("incorrect", 0)
                ) * 100

                # Plot the percentage
                bars = axes[i][col_counter].bar(["incorrect"], [percent_incorrect], color=["red"])

                # Multi-line title
                title = f"Chunk Size: {chunk_size}\nMethod: {method}\nK: {k}"
                axes[i][col_counter].set_title(
                    title, fontsize=10, y=1.08
                )  # Adjust fontsize and y-position of title
                axes[i][col_counter].set_ylim(0, 105)
                axes[i][col_counter].set_ylabel("Percentage")
                axes[i][col_counter].set_xlabel("qa_evals")

                # Adding the text label above the bar
                for bar in bars:
                    yval = bar.get_height()
                    axes[i][col_counter].text(
                        bar.get_x() + bar.get_width() / 2,
                        yval + 2,
                        round(yval, 2),
                        ha="center",
                        va="bottom",
                        color="black",
                        weight="bold",
                    )

                col_counter += 1  # Move to the next column for the next k value

    # Adjust layout spacing for titles
    fig.tight_layout(pad=3.0)

    # Save the plot to a file
    plt.savefig(os.path.join(save_dir, "percentage_incorrect_plot.png"), dpi=300)

    # Display the plot if 'show' is True
    if show:
        plt.show()
    else:
        plt.close(fig)
