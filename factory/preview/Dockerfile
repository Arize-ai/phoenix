FROM application
COPY launch.py seed_log.py /phoenix/preview/
COPY --from=seed seed.py /phoenix/preview/seed.py
ENV PHOENIX_ENABLE_AUTH=false
CMD ["/phoenix/preview/launch.py"]
