#!/usr/bin/fish
cd /home/yenlor/Git/chatapp/
source ./.venv/bin/activate.fish

set SESSION_NAME django

if tmux has-session -t $SESSION_NAME 2>/dev/null
    then
    echo "Session $SESSION_NAME already exists. Attaching to it."
    tmux attach-session -t $SESSION_NAME
else
    tmux new-session -d -s $SESSION_NAME
    tmux new-window -a
    tmux new-window -a
    tmux new-window -a
    tmux new-window -a
    tmux send-keys -t 1 "python manage.py runserver 0.0.0.0:8000" C-m
    tmux send-keys -t 2 "npm run build" C-m
    tmux send-keys -t 3 "sudo docker run --rm -p 6379:6379 redis:7" C-m
    tmux select-window -t 3
    tmux attach-session -t $SESSION_NAME
end
