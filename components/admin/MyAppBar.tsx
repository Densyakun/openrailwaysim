import * as React from 'react';
import { AppBar, AppBarProps, Logout, UserMenu, UserMenuProps } from 'react-admin';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { state as containerState } from '../Container';

const MyUserMenu = (props: UserMenuProps) => (
  <>
    {/*<UserMenu {...props}>
      <Logout />
    </UserMenu>*/}
    <IconButton color="inherit" onClick={() => { containerState.isOpen = false }}>
      <CloseIcon />
    </IconButton>
  </>
);

export const MyAppBar = (props: AppBarProps) => (
  <AppBar {...props} userMenu={<MyUserMenu />} />
);